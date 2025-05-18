"use client"
import { useState } from 'react';
import { CiSquareChevRight } from "react-icons/ci";
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '../src/utils/supabaseClient'; // Assurez-vous que le chemin est correct
import { useRouter } from 'next/router';
import { NotificationComponent } from './NotificationComponent';
import { GoEyeClosed, GoEye } from "react-icons/go";

export const SignUpComponent = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [notification, setNotification] = useState(null);
  const router = useRouter();

  const handleSignUp = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setNotification({
        type: 'error',
        message: 'Passwords do not match'
      });
      return;
    }
    
    setLoading(true);
    const { user, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          firstName,
          lastName
        }
      }
    });
    if (error) {
      setNotification({
        type: 'error',
        message: error.message
      });
    } else {
      setNotification({
        type: 'success',
        message: "Registration successful! Let's see pricing now."
      });
      setTimeout(() => {
        router.push('/pricing');
      }, 2000);
    }
    setLoading(false);
  };

  return(
    <section className='flex h-screen justify-center'>
      {notification && (
        <NotificationComponent
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="flex flex-col bg-white w-1/2 justify-center items-left p-20">
        <div className='mb-8'>
          <h3 className="text-black">Create an account 🚀</h3>
        </div>

        <form onSubmit={handleSignUp} className="w-full max-w-lg">
          <div className="mb-4">
            <div className='flex gap-3'>
              <input
                type="text"
                name="firstname"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="appearance-none border rounded-md w-full py-5 px-6 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
              <input
                type="text"
                name="lastname"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="appearance-none border rounded-md w-full py-5 px-6 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
            </div>
          </div>

          <div className="mb-4">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none border rounded-md w-full py-5 px-6 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
          </div>
          <div className="mb-6">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none border rounded-md w-full py-5 px-6 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <GoEyeClosed className="w-5 h-5" /> : <GoEye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div className="mb-6">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none border rounded-md w-full py-5 px-6 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <GoEyeClosed className="w-5 h-5" /> : <GoEye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button type="submit" disabled={loading}  className="bg-autocallblue text-white py-4 px-6 rounded-md focus:outline-none focus:shadow-outline">
              Get started
            </button>
            <p>Already subscribe ? <Link href="/sign-in" className='underline decoration-solid'>Sign in here</Link>.</p>
          </div>
        </form>
      </div>

      <div className="flex flex-col bg-autocallblue w-1/2 justify-center items-left gap-3 px-24">
        <Image src="/logo.svg" alt="logo" width={100} height={100} />
        <h1 className='text-white font-normal text-left text-4xl'>
        Collect debts. <br />
          More debt. <br />
          Cheaper. <br />
          Faster.
        </h1>
      </div>
    </section>
  )
}