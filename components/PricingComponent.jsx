import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaSpinner } from 'react-icons/fa';
import { IoFlash } from "react-icons/io5";
import { CiChat1, CiCircleAlert, CiCircleCheck, CiCircleRemove } from "react-icons/ci";
import { supabase } from '../src/utils/supabaseClient';
import { NotificationComponent } from './NotificationComponent';
import { NavBarComponent } from './NavBarComponent';

const plans = [
  {
    name: 'Starter',
    price: 400,
    minutes: 2000,
    additionalMinutePrice: 0.15,
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
  },
  {
    name: 'Growth',
    price: 700,
    minutes: 5000,
    additionalMinutePrice: 0.12,
    priceId: process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID,
  },
  {
    name: 'Enterprise',
    price: 1200,
    minutes: 10000,
    additionalMinutePrice: 0.10,
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
  },
  {
    name: 'Custom',
    isCustom: true,
    minutes: 'Unlimited',
    features: ['Custom pricing', 'Dedicated support', 'Custom integrations', 'Priority access to new features']
  }
];

// Couleurs personnalisées
const colors = {
  primary: '#4D48FF',
  primaryHover: '#3D39FF',
  primaryLight: '#6E6AFF',
  primaryLighter: '#E6E5FF',
  indigo: '#4309E4',
  indigoLight: '#5425FF',
};

export const PricingComponent = ({ user }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [lastSubscription, setLastSubscription] = useState(null);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const getSubscriptionPlan = (subscription) => {
    if (!subscription) return null;
    const plan = plans.find(plan => plan.priceId === subscription.stripe_price_id);
    if (!plan) {
      return {
        name: subscription.plan_name || 'Custom Plan',
        minutes: subscription.minutes,
        price: subscription.amount / 100
      };
    }
    return plan;
  };

  const fetchSubscriptionData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data: activeSubscription, error: activeError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (activeError && activeError.code !== 'PGRST116') {
        throw activeError;
      }

      if (activeSubscription) {
        const usedMinutes = Math.ceil((activeSubscription.used_seconds || 0) / 60);
        const remainingMins = Math.max(0, activeSubscription.minutes - usedMinutes);
        setRemainingMinutes(remainingMins);
        setHasActiveSubscription(true);
        setActiveSubscription(activeSubscription);
        setLastSubscription(null);
      } else {
        const { data: canceledSubscription, error: canceledError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'canceled')
          .order('canceled_at', { ascending: false })
          .limit(1)
          .single();

        if (!canceledError) {
          setLastSubscription(canceledSubscription);
        }
        
        setHasActiveSubscription(false);
        setActiveSubscription(null);
        setRemainingMinutes(0);
      }

    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setIsLoading(true);
      
      // Récupérer la session de l'utilisateur
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error);
      }

      // Rafraîchir les données de l'abonnement
      await fetchSubscriptionData();
      
      setNotification({
        type: 'success',
        message: 'Subscription canceled successfully'
      });

    } catch (error) {
      console.error('Error canceling subscription:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to cancel subscription'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (priceId) => {
    setIsLoading(true);
    try {
      // Vérifier que l'utilisateur est connecté
      if (!user) {
        router.push('/signin');
        return;
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An error occurred');
      }

      // Rediriger vers l'URL de paiement Stripe
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }

    } catch (error) {
      console.error('Error:', error);
      setNotification({
        type: 'error',
        message: error.message || 'An unexpected error occurred'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSales = () => {
    const subject = encodeURIComponent('Enterprise Plan Inquiry');
    const body = encodeURIComponent(
      `Hi Ayoub,\n\nI'm interested in learning more about the Enterprise plan for AutoPhone.\n\nBest regards`
    );
    window.location.href = `mailto:ayoub@autoph.one?subject=${subject}&body=${body}`;
  };

  const currentPlan = getSubscriptionPlan(activeSubscription || lastSubscription);

  return (
    <div className='flex h-screen bg-gray-50'>
      <NavBarComponent />
      <div className='flex-1 overflow-y-auto'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
          <div className='flex justify-between items-center mb-6'>
            <h1 className='text-lg font-medium text-gray-900'>Pricing Plans</h1>
            <div className='flex items-center space-x-3'>
              <div className='bg-white border border-gray-200 rounded-md px-3 py-1.5'>
                <div className='flex items-center space-x-3'>
                  <div>
                    <span className='text-xs text-gray-500'>Current Plan</span>
                    <div className='flex items-center gap-2'>
                      {isLoading ? (
                        <div className='h-5 w-20 bg-gray-200 animate-pulse rounded'></div>
                      ) : (
                        <span className='text-sm font-medium text-gray-900'>
                          {getSubscriptionPlan(activeSubscription || lastSubscription)?.name || 'No Plan'}
                        </span>
                      )}
                      {isLoading ? (
                        <div className='h-5 w-16 bg-gray-200 animate-pulse rounded-full'></div>
                      ) : hasActiveSubscription ? (
                        <>
                          <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                            Active
                          </span>
                          <button
                            onClick={() => setShowCancelPopup(true)}
                            className='inline-flex items-center px-2 py-0.5 border border-red-200 text-xs font-medium rounded-full text-red-600 hover:bg-red-50 transition-all duration-200'
                          >
                            Cancel
                          </button>
                        </>
                      ) : lastSubscription ? (
                        <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'>
                          Canceled
                        </span>
                      ) : (
                        <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'>
                          No Active Plan
                        </span>
                      )}
                    </div>
                  </div>
                  <div className='border-l border-gray-200 pl-3'>
                    <span className='text-xs text-gray-500'>Minutes</span>
                    {isLoading ? (
                      <div className='h-5 w-24 bg-gray-200 animate-pulse rounded'></div>
                    ) : (
                      <p className='text-sm font-medium text-gray-900'>
                        {((activeSubscription || lastSubscription)?.minutes || 0).toLocaleString()} available
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
            {plans.filter(plan => !plan.isCustom).map((plan) => (
              <div 
                key={plan.name} 
                className='bg-white border border-gray-200 rounded-md p-4 hover:border-gray-300 transition-all duration-200'
              >
                <div className='space-y-4'>
                  <div>
                    <h3 className='text-base font-medium text-gray-900'>{plan.name}</h3>
                    <div className='mt-2 flex items-baseline'>
                      <span className='text-2xl font-bold text-gray-900'>${plan.price}</span>
                      <span className='ml-1 text-sm text-gray-500'>/month</span>
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <div className='flex items-center text-sm text-gray-500'>
                      <span>{plan.minutes.toLocaleString()} minutes included</span>
                    </div>
                    <div className='flex items-center text-sm text-gray-500'>
                      <span>Additional minutes: ${plan.additionalMinutePrice.toFixed(2)}/min</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSubscribe(plan.priceId)}
                    disabled={isLoading}
                    className='w-full inline-flex items-center justify-center px-3 py-1.5 bg-black text-white text-xs font-normal rounded-md hover:bg-gray-800 transition-all duration-200 disabled:opacity-75'
                  >
                    {isLoading ? (
                      <>
                        <FaSpinner className="animate-spin w-3 h-3 mr-1.5" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <IoFlash className="w-3 h-3 mr-1.5" />
                        Subscribe Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Custom Plan */}
          <div className='bg-gradient-to-br from-[#4D48FF] to-[#3D39FF] rounded-md p-4 text-white'>
            <div className='space-y-4'>
              <div>
                <div className='flex items-center gap-2'>
                  <h3 className='text-base font-medium'>Enterprise</h3>
                  <span className='px-2 py-0.5 text-[11px] font-medium bg-white/20 text-white rounded-full'>
                    Custom
                  </span>
                </div>
                <div className='mt-2 flex items-baseline'>
                  <span className='text-2xl font-bold'>Custom</span>
                  <span className='ml-1 text-sm text-white/70'>/month</span>
                </div>
              </div>

              <div className='space-y-2'>
                {plans[3].features.map((feature, index) => (
                  <div key={index} className='flex items-center text-sm text-white/80'>
                    <IoFlash className="w-3.5 h-3.5 text-white mr-2" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleContactSales()}
                className='w-full inline-flex items-center justify-center px-3 py-1.5 bg-white text-[#4D48FF] text-xs font-normal rounded-md hover:bg-white/90 transition-all duration-200'
              >
                <CiChat1 className="w-3.5 h-3.5 mr-1.5" />
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelPopup && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4'>
          <div className='bg-white rounded-md shadow-lg max-w-md w-full'>
            <div className='p-4'>
              <h2 className='text-lg font-medium text-gray-900 mb-4'>Cancel Subscription</h2>
              <p className='text-sm text-gray-500 mb-4'>
                Are you sure you want to cancel your subscription? You will lose access to all premium features at the end of your current billing period.
              </p>
              <div className='flex justify-end gap-2'>
                <button 
                  onClick={() => setShowCancelPopup(false)}
                  className='px-3 py-1.5 border border-gray-200 rounded-md text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors'
                >
                  Keep Subscription
                </button>
                <button 
                  onClick={handleCancelSubscription}
                  disabled={isCanceling}
                  className='inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-normal hover:bg-red-700 transition-colors disabled:opacity-75'
                >
                  {isCanceling ? (
                    <>
                      <FaSpinner className="animate-spin w-3 h-3 mr-1.5" />
                      Canceling...
                    </>
                  ) : (
                    'Yes, Cancel Subscription'
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

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#4D48FF]"></div>
        </div>
      )}
    </div>
  );
}; 