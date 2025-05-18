import { useState, useEffect } from 'react';
import { CiCircleAlert, CiCircleCheck, CiCircleRemove } from "react-icons/ci";

export const NotificationComponent = ({ message, type = 'info', onClose, duration = 3000 }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (duration) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                onClose?.();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    if (!isVisible) return null;

    const getTypeStyles = () => {
        switch (type) {
            case 'error':
                return 'bg-white border border-red-100 text-red-600';
            case 'success':
                return 'bg-white border border-green-100 text-green-600';
            case 'warning':
                return 'bg-yellow-50 text-yellow-600 border-yellow-100';
            default:
                return 'bg-blue-50 text-blue-600 border-blue-100';
        }
    };

    
    return (
        <div className={`fixed top-4 right-4 p-3 rounded-md shadow-sm ${getTypeStyles()}`}>
            <div className="flex items-center gap-2 pr-6">
                {type === 'error' ? (
                    <CiCircleAlert className="w-4 h-4 flex-shrink-0" />
                ) : (
                    <CiCircleCheck className="w-4 h-4 flex-shrink-0" />
                )}
                <p className="text-xs font-medium">{message}</p>
                <button 
                    onClick={() => {
                        setIsVisible(false);
                        onClose?.();
                    }}
                    className="absolute top-2 right-2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full"
                >
                    <CiCircleRemove className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}; 