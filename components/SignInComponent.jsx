"use client"
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { supabase } from '../src/utils/supabaseClient'; // Assurez-vous que le chemin est correct
import { NotificationComponent } from './NotificationComponent';
import { GoEyeClosed, GoEye } from "react-icons/go";

export const SignInComponent = () => {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });
    if (error) {
      setNotification({
        type: 'error',
        message: error.message
      });
    } else {
      setNotification({
        type: 'success',
        message: 'Login successful! Redirecting...'
      });
      setTimeout(() => {
        router.push('/');
      }, 1000);
    }
  };

  return (
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
          <h3 className="text-black">Let&apos;s go!</h3>
          <p>More than an AI, a real companion for all your company&apos;s calls.</p>
        </div>
   
        <form className="w-full max-w-lg" onSubmit={handleSubmit}>
  
          <div className="mb-4">
          <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          className="appearance-none border rounded-md w-full py-5 px-6 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
          </div>
          <div className="mb-6">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
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
            <button
              type="submit"
              className="bg-autocallblue text-white py-4 px-8 rounded-md focus:outline-none focus:shadow-outline"
            >
              Sign in
            </button>
            <p>Don&apos;t have an account ? <Link href="/sign-up" className='underline decoration-solid'>Subscribe here</Link>.</p>
          </div>
        </form>
      </div>

      <div className="flex bg-autocallblue w-1/2 justify-center items-center">
        <Image src="/logo.svg" width={36} height={36} alt="logo" className='w-1/4' />
      </div>

    </section>
  );
}