import { useRouter } from 'next/router';
import { IoPhonePortrait, IoListSharp, IoCheckmarkCircleOutline } from "react-icons/io5";
import { NavBarComponent } from './NavBarComponent';

export const SuccessComponent = () => {
  const router = useRouter();

  return (
    <div className='flex h-screen bg-gray-50'>
      <NavBarComponent />
      <div className='flex-1 overflow-hidden'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
          <div className='flex justify-between items-center mb-6'>
            <h1 className='text-lg font-medium text-gray-900'>Payment Status</h1>
          </div>

          <div className='bg-white border border-gray-200 rounded-md p-6'>
            <div className='flex flex-col items-center text-center mb-8'>
              <div className='mb-4'>
                <IoCheckmarkCircleOutline className="w-16 h-16 text-green-500" />
              </div>
              <h2 className='text-xl font-medium text-gray-900 mb-2'>
                Payment Successful!
              </h2>
              <p className='text-sm text-gray-500 max-w-md'>
                Thank you for your subscription. Your payment has been successfully processed. You can now start using all the premium features.
              </p>
            </div>

            <div className='max-w-md mx-auto'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <button
                  onClick={() => router.push('/phone-numbers')}
                  className='inline-flex items-center justify-center px-4 py-2 bg-black text-white text-sm font-normal rounded-md hover:bg-gray-800 transition-all duration-200'
                >
                  <IoPhonePortrait className="w-4 h-4 mr-1.5" />
                  Phone Numbers
                </button>
                <button
                  onClick={() => router.push('/yourlists')}
                  className='inline-flex items-center justify-center px-4 py-2 bg-black text-white text-sm font-normal rounded-md hover:bg-gray-800 transition-all duration-200'
                >
                  <IoListSharp className="w-4 h-4 mr-1.5" />
                  Create List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 