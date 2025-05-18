import { useState, useEffect } from 'react';
import { FaHome, FaPhone, FaUserSecret, FaChartLine } from 'react-icons/fa';
import { CiHome, CiPhone, CiUser, CiInboxOut, CiHeadphones, CiRoute, CiAlignBottom, CiPlug1, CiSliderHorizontal, CiCreditCard2, CiMicrochip, CiSpeaker, CiSettings, CiLogout, CiChat1 } from "react-icons/ci";
import { MdSettings, MdLogout } from 'react-icons/md';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '../src/utils/supabaseClient';
import { useRouter } from 'next/router';

export const NavBarComponent = () => {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [usagePercent, setUsagePercent] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchUserData();
        fetchSubscriptionData();
    }, []);

    const fetchUserData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Error fetching user:', error);
            setIsLoading(false);
        }
    };

    const fetchSubscriptionData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('subscriptions')
                    .select('remaining_minutes, minutes, used_seconds')
                    .eq('user_id', user.id)
                    .eq('status', 'active')
                    .single();

                if (error) throw error;

                if (data) {
                    const usagePercentage = data.minutes > 0 
                        ? ((data.minutes - data.remaining_minutes) / data.minutes) * 100 
                        : 0;
                    setUsagePercent(Math.min(100, Math.max(0, usagePercentage)));
                    setSubscription({
                        ...data,
                        used_seconds: data.used_seconds || 0
                    });
                }
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Error fetching subscription:', error);
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            router.push('/sign-in');
        } else {
            console.error('Erreur de déconnexion:', error.message);
        }
    };

    const handleTalkWithFounder = () => {
        const subject = encodeURIComponent('AutoPhone Discussion');
        const body = encodeURIComponent(
            `Hi Ayoub,\n\nI'd like to discuss about AutoPhone.\n\nBest regards`
        );
        window.location.href = `mailto:ayoub@autoph.one?subject=${subject}&body=${body}`;
    };

    const isActivePath = (path) => {
        return router.pathname === path;
    };

    return (
        <div className='nav-container sticky top-0 w-60 border-r border-gray-200 flex flex-col h-screen bg-white'>
            {/* Main content - top section */}
            <div className='flex flex-col w-full px-3 py-4'>
                <div className='mb-6 flex items-center'>
                    <Image src="/logo.svg" alt="logo.svg" width={32} height={32} className='w-8 h-8 rounded-md' />
                    <h1 className='text-base ml-2.5 text-gray-900 font-medium'>Paycall</h1>
                </div>
                
                <div className='flex flex-col space-y-0.5'>
                    <Link 
                        href="/" 
                        className={`flex items-center w-full rounded-md px-2.5 py-2 transition-colors ${
                            isActivePath('/') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <CiHome className="w-4 h-4" />
                        <span className='ml-2.5 text-[13px] font-normal'>Home</span>
                    </Link>

                    <Link 
                        href="/phone-numbers" 
                        className={`flex items-center w-full rounded-md px-2.5 py-2 transition-colors ${
                            isActivePath('/phone-numbers') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <CiPhone className="w-4 h-4" />
                        <span className='ml-2.5 text-[13px] font-normal'>Phone Numbers</span>
                    </Link>
                    
                    <Link 
                        href="/yourlists" 
                        className={`flex items-center w-full rounded-md px-2.5 py-2 transition-colors ${
                            isActivePath('/yourlists') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <CiPhone className="w-4 h-4" />
                        <span className='ml-2.5 text-[13px] font-normal'>Your Lists</span>
                    </Link>
                    
                    <Link 
                        href="/sequences" 
                        className={`flex items-center w-full rounded-md px-2.5 py-2 transition-colors ${
                            isActivePath('/launchsequence') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <CiInboxOut className="w-4 h-4" />
                        <span className='ml-2.5 text-[13px] font-normal'>Sequences</span>
                    </Link>
                    
                    <Link 
                        href="/analytics" 
                        className={`flex items-center w-full rounded-md px-2.5 py-2 transition-colors ${
                            isActivePath('/analytics') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <CiAlignBottom className="w-4 h-4" />
                        <span className='ml-2.5 text-[13px] font-normal'>Analytics</span>
                    </Link>
                </div>
            </div>

            {/* Bottom section */}
            <div className='mt-auto px-3 pb-4'>
                {/* User Profile Card - Above divider */}
                <div 
                    onClick={() => router.push('/profile')}
                    className='p-2.5 border border-gray-100 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all duration-200 cursor-pointer'
                >
                    <div className='flex items-center justify-between'>
                        <div className='flex-1 min-w-0'>
                            {isLoading ? (
                                <>
                                    <div className='animate-pulse'>
                                        <div className='h-3 w-24 bg-gray-200 rounded'></div>
                                        <div className='h-2.5 w-32 bg-gray-200 rounded mt-1'></div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className='text-xs font-medium text-gray-900 truncate'>
                                        {user?.user_metadata?.firstName} {user?.user_metadata?.lastName}
                                    </p>
                                    <p className='text-[11px] text-gray-500 truncate mt-0.5'>
                                        {user?.email}
                                    </p>
                                </>
                            )}
                        </div>
                        {subscription && (
                            <div className='relative w-8 h-8 ml-2'>
                                <svg className='w-full h-full transform -rotate-90'>
                                    <circle
                                        className='text-gray-200'
                                        strokeWidth='1.5'
                                        stroke='currentColor'
                                        fill='transparent'
                                        r='14'
                                        cx='16'
                                        cy='16'
                                    />
                                    <circle
                                        className='text-[#4D48FF]'
                                        strokeWidth='1.5'
                                        strokeDasharray={`${88 * ((100 - usagePercent) / 100)} 88`}
                                        strokeLinecap='round'
                                        stroke='currentColor'
                                        fill='transparent'
                                        r='14'
                                        cx='16'
                                        cy='16'
                                    />
                                </svg>
                                <div className='absolute inset-0 flex items-center justify-center'>
                                    <span className='text-[7.5px] font-medium text-gray-700'>
                                        {100 - usagePercent}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    {subscription && (
                        <div className='mt-1.5 text-[10px] text-gray-500'>
                            {Math.max(0, subscription.minutes - Math.ceil((subscription.used_seconds || 0) / 60)).toLocaleString()} minutes remaining
                        </div>
                    )}
                </div>

                <div className='border-t border-gray-200 mt-4 pt-4'>
                    <div className='flex flex-col space-y-0.5'>
                        <Link 
                            href="/pricing" 
                            className={`flex items-center w-full rounded-md px-2.5 py-2 transition-colors ${
                                isActivePath('/pricing') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                        >
                            <CiCreditCard2 className="w-4 h-4" />
                            <span className='ml-2.5 text-[13px] font-normal'>Billing</span>
                        </Link>
                        
                        <button
                            onClick={handleTalkWithFounder}
                            className='flex items-center w-full rounded-md px-2.5 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors'
                        >
                            <CiChat1 className="w-4 h-4" />
                            <span className='ml-2.5 text-[13px] font-normal'>Talk with the founder</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className='flex items-center w-full rounded-md px-2.5 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors'
                        >
                            <CiLogout className="w-4 h-4" />
                            <span className='ml-2.5 text-[13px] font-normal'>Logout</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}