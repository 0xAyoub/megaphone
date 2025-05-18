import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { IoSettingsOutline, IoKeyOutline, IoDownloadOutline, IoPencil } from "react-icons/io5";
import { FaArrowRight, FaSpinner } from "react-icons/fa";
import { NavBarComponent } from './NavBarComponent';
import { supabase } from '../src/utils/supabaseClient';
import { NotificationComponent } from './NotificationComponent';

const getSubscriptionPlan = (subscription) => {
  const plans = [
    {
      name: 'Starter',
      price: 400,
      minutes: 2000,
      priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
    },
    {
      name: 'Growth',
      price: 700,
      minutes: 5000,
      priceId: process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID,
    },
    {
      name: 'Enterprise',
      price: 1200,
      minutes: 10000,
      priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
    }
  ];

  if (!subscription) return null;
  const plan = plans.find(plan => plan.priceId === subscription.stripe_price_id);
  if (!plan) {
    return {
      name: 'Custom Plan',
      minutes: subscription.minutes
    };
  }
  return plan;
};

export const ProfileComponent = () => {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    businessPhone: ''
  });
  const [subscriptions, setSubscriptions] = useState([]);
  const [page, setPage] = useState(0);
  const subscriptionsPerPage = 4;
  const [notification, setNotification] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchSubscriptions();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("User data:", user);
      if (user) {
        const response = await fetch(`/api/getNumbersOfUser?userId=${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch phone numbers');
        }
        const phoneNumbers = await response.json();
        const businessPhone = phoneNumbers && phoneNumbers.length > 0 ? phoneNumbers[0].phone_number : '';

        setUserData({
          firstName: user.user_metadata.firstName || '',
          lastName: user.user_metadata.lastName || '',
          email: user.email,
          businessPhone
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching subscriptions:', error);
      } else {
        setSubscriptions(subscriptions);
      }
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    if (confirmEmail !== userData.email) return;
    
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/deleteUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': session.access_token
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete account');
      }

      await supabase.auth.signOut();
      router.push('/sign-in');
    } catch (error) {
      console.error('Error:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to delete account'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setNotification({
        type: 'error',
        message: 'First name and last name are required'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (!session) {
        throw new Error('No active session');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim()
        }
      });

      if (updateError) throw updateError;

      // Mettre à jour l'état local
      setUserData(prev => ({
        ...prev,
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim()
      }));

      setIsEditing(false);
      setNotification({
        type: 'success',
        message: 'Profile updated successfully!'
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to update profile'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextPage = () => {
    if ((page + 1) * subscriptionsPerPage < subscriptions.length) {
      setPage(page + 1);
    }
  };

  const previousPage = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  const displayedSubscriptions = subscriptions.slice(page * subscriptionsPerPage, (page + 1) * subscriptionsPerPage);

  return (
    <div className='flex h-screen bg-gray-50'>
      <NavBarComponent />
      <div className='flex-1 overflow-y-auto'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
          <div className='flex justify-between items-center mb-6'>
            <h1 className='text-lg font-medium text-gray-900'>Your Profile</h1>
            <div className='flex items-center space-x-3'>
              <div className='bg-white border border-gray-200 rounded-md px-3 py-1.5'>
                <div className='flex items-center space-x-3'>
                  <div>
                    <span className='text-xs text-gray-500'>Current Plan</span>
                    <div className='flex items-center gap-2'>
                      {isLoading ? (
                        <div className='animate-pulse flex items-center gap-2'>
                          <div className='h-4 w-20 bg-gray-200 rounded'></div>
                          <div className='h-4 w-16 bg-gray-200 rounded-full'></div>
                        </div>
                      ) : (
                        <>
                          <span className='text-sm font-medium text-gray-900'>
                            {getSubscriptionPlan(subscriptions[0])?.name || 'No Plan'}
                          </span>
                          {subscriptions[0].status === 'active' && (
                            <>
                              <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                                Active
                              </span>
                              <button
                                onClick={() => router.push('/pricing')}
                                className='inline-flex items-center px-2 py-0.5 border border-red-200 text-xs font-medium rounded-full text-red-600 hover:bg-red-50 transition-all duration-200'
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid container pour les sections */}
          <div className='grid grid-cols-2 gap-3'>
            {/* Colonne de gauche */}
            <div className='space-y-3'>
              {/* Personal Information Section */}
              <div className='bg-white border border-gray-200 rounded-md p-4'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='text-xs font-medium text-gray-900'>Personal Information</h2>
                  {!isLoading && (
                    <button 
                      onClick={() => {
                        if (isEditing) {
                          setIsEditing(false);
                        } else {
                          setEditForm({
                            firstName: userData.firstName,
                            lastName: userData.lastName
                          });
                          setIsEditing(true);
                        }
                      }}
                      className='p-1.5 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-50'
                    >
                      <IoPencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className='space-y-4'>
                  {isLoading ? (
                    <>
                      <div className='animate-pulse space-y-4'>
                        <div>
                          <div className='h-3 w-16 bg-gray-200 rounded mb-1'></div>
                          <div className='h-4 w-32 bg-gray-200 rounded'></div>
                        </div>
                        <div>
                          <div className='h-3 w-16 bg-gray-200 rounded mb-1'></div>
                          <div className='h-4 w-32 bg-gray-200 rounded'></div>
                        </div>
                        <div>
                          <div className='h-3 w-16 bg-gray-200 rounded mb-1'></div>
                          <div className='h-4 w-48 bg-gray-200 rounded'></div>
                        </div>
                        <div>
                          <div className='h-3 w-16 bg-gray-200 rounded mb-1'></div>
                          <div className='h-4 w-32 bg-gray-200 rounded'></div>
                        </div>
                      </div>
                    </>
                  ) : isEditing ? (
                    <>
                      <div>
                        <p className='text-[11px] font-normal text-gray-600 mb-1'>First Name</p>
                        <input
                          type="text"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className='w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-200'
                          placeholder="Enter your first name"
                        />
                      </div>
                      <div>
                        <p className='text-[11px] font-normal text-gray-600 mb-1'>Last Name</p>
                        <input
                          type="text"
                          value={editForm.lastName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                          className='w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-200'
                          placeholder="Enter your last name"
                        />
                      </div>
                      <div className='flex gap-2'>
                        <button 
                          onClick={handleUpdateProfile}
                          disabled={isSubmitting}
                          className='inline-flex items-center px-3 py-1.5 bg-black text-white text-xs font-normal rounded-md hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          {isSubmitting ? (
                            <>
                              <FaSpinner className="animate-spin w-3 h-3 mr-1.5" />
                              Saving...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          disabled={isSubmitting}
                          className='px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800'
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className='text-[11px] font-normal text-gray-600 mb-1'>First Name</p>
                        <p className='text-xs text-gray-900'>{userData.firstName}</p>
                      </div>
                      <div>
                        <p className='text-[11px] font-normal text-gray-600 mb-1'>Last Name</p>
                        <p className='text-xs text-gray-900'>{userData.lastName}</p>
                      </div>
                      <div>
                        <p className='text-[11px] font-normal text-gray-600 mb-1'>Email</p>
                        <p className='text-xs text-gray-900'>{userData.email}</p>
                      </div>
                      <div>
                        <p className='text-[11px] font-normal text-gray-600 mb-1'>Business Phone</p>
                        <p className='text-xs text-gray-900'>{userData.businessPhone}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Security Section */}
              <div className='bg-white border border-gray-200 rounded-md p-4'>
                <div className='flex items-center gap-2 mb-3'>
                  <IoKeyOutline className="w-3.5 h-3.5 text-gray-600" />
                  <h2 className='text-xs font-medium text-gray-900'>Security</h2>
                </div>
                <div className='space-y-2'>
                  {isLoading ? (
                    <div className='animate-pulse space-y-2'>
                      <div className='h-8 bg-gray-200 rounded'></div>
                      <div className='h-8 bg-gray-200 rounded'></div>
                    </div>
                  ) : (
                    <>
                      <button className='w-full inline-flex items-center justify-between px-3 py-1.5 border border-gray-200 rounded-md text-xs text-gray-700 hover:bg-gray-50'>
                        <span>Change Password</span>
                        <span className='text-gray-400'>•••••••</span>
                      </button>
                      <button 
                        onClick={handleDeleteAccount}
                        className='w-full inline-flex items-center justify-between px-3 py-1.5 border border-red-300 text-xs font-normal rounded-md text-red-700 bg-red-50 hover:bg-red-100 transition-all duration-200'
                      >
                        <span>Delete Account</span>
                        <span className='text-red-400'>Permanently delete your account</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Colonne de droite - Subscriptions */}
            <div className='bg-white border border-gray-200 rounded-md p-4'>
              <div className='flex items-center gap-2 mb-3'>
                <IoSettingsOutline className="w-3.5 h-3.5 text-gray-600" />
                <h2 className='text-xs font-medium text-gray-900'>Subscriptions</h2>
              </div>
              <div className='space-y-2'>
                {isLoading ? (
                  <div className='animate-pulse space-y-2'>
                    {[...Array(3)].map((_, index) => (
                      <div key={index} className='p-3 border border-gray-200 rounded-md'>
                        <div className='flex justify-between items-center'>
                          <div className='space-y-2'>
                            <div className='h-4 w-24 bg-gray-200 rounded'></div>
                            <div className='flex items-center gap-2'>
                              <div className='h-3 w-20 bg-gray-200 rounded'></div>
                              <div className='h-3 w-3 bg-gray-200 rounded-full'></div>
                              <div className='h-3 w-16 bg-gray-200 rounded'></div>
                            </div>
                          </div>
                          <div className='h-6 w-16 bg-gray-200 rounded'></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {displayedSubscriptions.map((subscription, index) => (
                      <div key={index} className='flex justify-between items-center p-3 border border-gray-200 rounded-md'>
                        <div>
                          <p className='text-xs font-medium text-gray-900'>
                            {getSubscriptionPlan(subscription)?.name}
                          </p>
                          <div className='flex items-center gap-2 mt-1'>
                            <p className='text-[11px] text-gray-500'>{new Date(subscription.created_at).toLocaleDateString()}</p>
                            <span className='text-[11px] text-gray-400'>•</span>
                            <p className='text-[11px] text-gray-500'>{subscription.minutes.toLocaleString()} minutes</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-md inline-flex items-center gap-1.5 ${
                          subscription.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            subscription.status === 'active' ? 'bg-green-500' : 'bg-gray-500'
                          }`}></span>
                          {subscription.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              {subscriptions.length > subscriptionsPerPage && (
                <div className='flex flex-col mt-4 pt-4 border-t border-gray-200'>
                  <div className='flex-1'>
                    {/* Liste des abonnements reste ici */}
                  </div>
                  <div className='flex justify-between items-center mt-auto'>
                    <button 
                      onClick={previousPage}
                      disabled={page === 0}
                      className={`inline-flex items-center px-2 py-1 rounded-md ${
                        page === 0 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaArrowRight className="w-2.5 h-2.5 transform rotate-180" />
                    </button>
                    <span className='text-xs text-gray-500'>
                      Page {page + 1} of {Math.ceil(subscriptions.length / subscriptionsPerPage)}
                    </span>
                    <button 
                      onClick={nextPage}
                      disabled={(page + 1) * subscriptionsPerPage >= subscriptions.length}
                      className={`inline-flex items-center px-2 py-1 rounded-md ${
                        (page + 1) * subscriptionsPerPage >= subscriptions.length
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Modal - Version épurée */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg">
            <div className="space-y-4">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-sm font-medium text-gray-900">Delete account</h3>
                <p className="mt-2 text-xs text-gray-500">
                  This will permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>

              <div>
                <div className="mb-1.5">
                  <label className="text-xs text-gray-600">
                    Type your email to confirm
                  </label>
                  <p className="text-[11px] text-gray-400">{userData.email}</p>
                </div>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-gray-200"
                  placeholder="Enter your email"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmEmail('');
                  }}
                  className="px-3 py-1.5 text-xs font-normal text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAccount}
                  disabled={confirmEmail !== userData.email || isDeleting}
                  className={`px-3 py-1.5 text-xs font-normal rounded-md ${
                    confirmEmail === userData.email && !isDeleting
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isDeleting ? 'Deleting...' : 'Delete account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Component */}
      {notification && (
        <NotificationComponent
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}; 