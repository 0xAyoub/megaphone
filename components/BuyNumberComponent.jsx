import { useState, useEffect } from 'react';
import { NavBarComponent } from './NavBarComponent';
import { supabase } from '../src/utils/supabaseClient';
import { CiSquareChevRight } from "react-icons/ci";
import Link from 'next/link';
import { FaArrowRight, FaPhone } from 'react-icons/fa';
import { NotificationComponent } from './NotificationComponent';

export const BuyNumberComponent = () => {
    const [numbers, setNumbers] = useState([]);
    const [region, setRegion] = useState('');
    const [userNumbers, setUserNumbers] = useState([]);
    const [userPhoneNumbers, setUserPhoneNumbers] = useState([]);
    const [page, setPage] = useState(0);
    const numbersPerPage = 5;
    const [allNumbers, setAllNumbers] = useState([]);
    const [displayedNumbers, setDisplayedNumbers] = useState([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedNumber, setSelectedNumber] = useState(null);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [notification, setNotification] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const getUserId = async () => {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            console.error('Error fetching user:', error);
            return null;
        }
        return data.user.id;
    };

    const fetchNumbers = async (region) => {
        try {
            const response = await fetch(`/api/numbers?region=${region}`);
            if (!response.ok) {
                throw new Error('Failed to fetch numbers');
            }
            const data = await response.json();
            setAllNumbers(data);
            updateDisplayedNumbers(0, data);
            setPage(0);
        } catch (error) {
            console.error('Error fetching numbers:', error);
            alert('Failed to load numbers');
        }
    };

    const updateDisplayedNumbers = (newPage, numbers = allNumbers) => {
        const start = newPage * numbersPerPage;
        const end = start + numbersPerPage;
        setDisplayedNumbers(numbers.slice(start, end));
    };

    const nextPage = () => {
        if ((page + 1) * numbersPerPage < allNumbers.length) {
            const newPage = page + 1;
            setPage(newPage);
            updateDisplayedNumbers(newPage);
        }
    };

    const previousPage = () => {
        if (page > 0) {
            const newPage = page - 1;
            setPage(newPage);
            updateDisplayedNumbers(newPage);
        }
    };

    const handleNumberSelect = (number, countryCode) => {
        setSelectedNumber({ number, countryCode });
        setShowConfirmModal(true);
    };

    const handleBuyNumber = async () => {
        setIsLoading(true);
        
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                setNotification({
                    type: 'error',
                    message: 'Please log in to continue'
                });
                return;
            }

            const response = await fetch('/api/buyNumber', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                setNotification({
                    type: 'error',
                    message: data.message || 'Failed to purchase phone number'
                });
                return;
            }

            setNotification({
                type: 'success',
                message: 'Phone number purchased successfully!'
            });
            setShowConfirmModal(false);
            fetchUserNumbers(); // Refresh the user's numbers
            
        } catch (error) {
            setNotification({
                type: 'error',
                message: 'An unexpected error occurred. Please try again.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUserNumbers = async () => {
        try {
            const userId = await getUserId();
            if (!userId) return;

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/getNumbersOfUser?userId=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch numbers');
            
            const data = await response.json();
            setUserPhoneNumbers(data || []);
        } catch (error) {
            console.error('Error fetching user numbers:', error);
        }
    };

    const loadMoreNumbers = async () => {
        try {
            const response = await fetch(`/api/numbers?region=${region}&page=${page + 1}&limit=${numbersPerPage}`);
            if (!response.ok) {
                throw new Error('Failed to fetch numbers');
            }
            const newNumbers = await response.json();
            if (newNumbers.length > 0) {
                setNumbers(newNumbers);
                setPage(page + 1);
            }
        } catch (error) {
            console.error('Error fetching more numbers:', error);
        }
    };

    useEffect(() => {
        fetchUserNumbers();
    }, []);

    const ConfirmationModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-center mb-4">
                    <div className="bg-blue-50 p-3 rounded-full">
                        <FaPhone className="w-6 h-6 text-blue-600" />
                    </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                    Confirm Phone Number Reservation
                </h3>
                <p className="text-sm text-gray-500 text-center mb-4">
                    You are about to reserve the number:
                </p>
                <p className="text-base font-medium text-gray-900 text-center mb-6">
                    {selectedNumber?.number}
                </p>
                <p className="text-xs text-gray-500 text-center mb-6">
                    Note: Once reserved, this number will be linked to your account. To change it, you'll need to contact our support team.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowConfirmModal(false)}
                        className="flex-1 px-4 py-2 text-sm font-normal text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 transition-all duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleBuyNumber}
                        className="flex-1 px-4 py-2 text-sm font-normal text-white bg-black rounded-md hover:bg-gray-800 transition-all duration-200"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className='flex h-screen bg-gray-50'>
            <NavBarComponent/>
            <div className='flex-1 overflow-y-auto'>
                {notification && (
                    <NotificationComponent
                        type={notification.type}
                        message={notification.message}
                        onClose={() => setNotification(null)}
                    />
                )}

                {showSuccessMessage && (
                    <div className="fixed top-4 right-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md shadow-sm">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm font-medium">
                                    Phone number added successfully
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
                    <div className='flex justify-between items-center mb-6'>
                        <h1 className='text-lg font-medium text-gray-900'>Phone Numbers</h1>
                    </div>

                    <div className='grid grid-cols-2 gap-6'>
                        {/* Section de gauche - Achat de numéros */}
                        <div className='bg-white rounded-md border border-gray-200 p-6'>
                            <h2 className='text-sm font-medium text-gray-900 mb-4'>Get a phone number</h2>
                            <div className='flex items-center gap-4 mb-6'>
                                <div className='flex-1'>
                                    <label htmlFor="region" className='block text-sm font-normal text-gray-700 mb-1'>
                                        Region code
                                    </label>
                                    <div className='flex items-center gap-3'>
                                        <input
                                            type="text"
                                            id="region"
                                            value={region}
                                            onChange={(e) => setRegion(e.target.value)}
                                            placeholder="Example: 941"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <button 
                                            onClick={() => fetchNumbers(region)}
                                            className='inline-flex items-center px-3 py-2 bg-black text-white text-sm font-normal rounded-md hover:bg-gray-800 transition-all duration-200'
                                        >
                                            Search
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className='space-y-3'>
                                {displayedNumbers.map((number, index) => (
                                    <div 
                                        key={index} 
                                        className='flex justify-between items-center p-4 border border-gray-200 rounded-md hover:border-gray-300 transition-all duration-200'
                                    >
                                        <div className='flex items-center'>
                                            <span className='text-sm font-normal text-gray-900'>{number.friendlyName}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleNumberSelect(number.phoneNumber, number.countryCode)}
                                            className='inline-flex items-center px-3 py-1.5 bg-black text-white text-sm font-normal rounded-md hover:bg-gray-800 transition-all duration-200'
                                        >
                                            <FaArrowRight className="font-medium w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                
                                {allNumbers.length > 0 && (
                                    <div className='flex justify-between items-center mt-4 pt-4 border-t border-gray-200'>
                                        <button 
                                            onClick={previousPage}
                                            disabled={page === 0}
                                            className={`inline-flex items-center px-2 py-1 rounded-md ${
                                                page === 0 
                                                ? 'text-gray-300 cursor-not-allowed' 
                                                : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <FaArrowRight className="w-4 h-4 transform rotate-180" />
                                        </button>
                                        <span className='text-sm text-gray-500'>
                                            Page {page + 1} of {Math.ceil(allNumbers.length / numbersPerPage)}
                                        </span>
                                        <button 
                                            onClick={nextPage}
                                            disabled={(page + 1) * numbersPerPage >= allNumbers.length}
                                            className={`inline-flex items-center px-2 py-1 rounded-md ${
                                                (page + 1) * numbersPerPage >= allNumbers.length
                                                ? 'text-gray-300 cursor-not-allowed' 
                                                : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <FaArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                
                                {displayedNumbers.length === 0 && (
                                    <div className='text-center py-6 text-gray-500 text-sm'>
                                        Search for available phone numbers by entering a region code
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section de droite - Numéros actuels */}
                        <div className='bg-white rounded-md border border-gray-200 p-6'>
                            <h2 className='text-sm font-medium text-gray-900 mb-4'>Your phone numbers</h2>
                            <div className='space-y-3'>
                                {userPhoneNumbers
                                    .filter(subscription => subscription.phone_number)
                                    .map((subscription, index) => (
                                        <div 
                                            key={index} 
                                            className='flex justify-between items-center p-4 border border-gray-200 rounded-md hover:border-gray-300 transition-all duration-200'
                                        >
                                            <div className='flex items-center'>
                                                <span className='text-sm font-normal text-gray-900'>
                                                    {subscription.phone_number}
                                                </span>
                                            </div>
                                            <span className='text-xs px-2 py-1 rounded-md inline-flex items-center gap-1.5 bg-green-50 text-green-700'>
                                                <span className='w-1.5 h-1.5 rounded-full bg-green-500'></span>
                                                Active
                                            </span>
                                        </div>
                                    ))}
                                {userPhoneNumbers.filter(subscription => subscription.phone_number).length === 0 && (
                                    <div className='text-center py-6 text-gray-500 text-sm'>
                                        You don't have any phone numbers yet
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showConfirmModal && <ConfirmationModal />}
        </div>
    );
}