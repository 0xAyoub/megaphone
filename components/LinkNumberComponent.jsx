import { useState, useEffect } from 'react';
import { NavBarComponent } from './NavBarComponent';
import { useRouter } from 'next/router';

export const LinkNumberComponent = () => {
    const router = useRouter();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [validationCode, setValidationCode] = useState(null); // Ajout d'un état pour stocker le code de validation
    const [userPhoneNumbers, setUserPhoneNumbers] = useState([]);

    const handleVerifyNumber = async () => {
        const response = await fetch('/api/verifyNumber', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phoneNumber }),
        });

        const data = await response.json();
        // alert(data.message);
        if (data.validationCode) {
            setValidationCode(data.validationCode); // Stocker le code de validation
        }
    };
    // savePhoneNumber()
    





    return (
        <div className='flex h-screen overflow-auto'>
            <NavBarComponent/>
            <div className='flex w-full'>
                <div className='flex flex-col gap-5 w-7/12 p-7 border-r'>
                    <h1 className='text-3xl'>Link number</h1>
                    <div className='flex gap-2'>
                        <input type="text"
                            placeholder="Entrez votre numéro de téléphone"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="input input-bordered w-full max-w-xs border p-2 rounded-md"
                        />
                        <button
                            className="btn btn-primary border px-4 py-2 text-white rounded-md bg-autocallblue"
                            onClick={handleVerifyNumber}
                        >
                            Vérifier le numéro
                        </button>
                    </div>
                    {/* Affichage conditionnel du code de validation */}
                    {validationCode && (
                        <div className="mt-4 text-lg">
                            Code de validation: {validationCode}
                        </div>
                    )}
                     <button
                            className="btn btn-primary border px-4 py-2 text-white rounded-md bg-autocallblue"

                        >
                            Enregistrer le numéro
                        </button>
                </div>
                <div className='flex flex-col gap-5 w-5/12 p-7'>
                    <h1 className='text-3xl'>My numbers</h1>
                    <ul className='flex w-full flex-col gap-2'>
                        {/* {userPhoneNumbers.map((phone, index) => (
                            <li className='text-lg p-4 border rounded-md' key={index}>{phone.phone_number}</li>
                        ))} */}
                    </ul>
                </div>
            </div>
        </div>
    );
}