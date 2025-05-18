import { useState } from 'react'; // useEffect n'est pas utilisé
import { NavBarComponent } from './NavBarComponent';
import Link from 'next/link';
import { CiSquareChevRight, CiSignpostR1 } from "react-icons/ci";
import { GoArrowSwitch } from "react-icons/go";
import { MdArrowOutward } from "react-icons/md";

export const SendCallComponent = () => {

    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [instruction, setInstruction] = useState('');
    const [target, setTarget] = useState('');
    const [transferNumber, setTransferNumber] = useState('');

    const handleSendCall = async () => {
        const response = await fetch('/api/sendCall', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to,
                instruction,
                target,
                transferNumber
            }),
        });

        const data = await response.json();
        console.log(data);
    };

   const handleTerminateCall = async () => {
  const response = await fetch('/api/sendCall/terminate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  console.log(data);
};

    return (
        <div className='flex h-screen overflow-auto'>
          
            <NavBarComponent/>
            
            <div className='flex w-full'>

            <div className='flex flex-col gap-5 w-7/12 p-7 border-r'>
                <h1 className='text-3xl'>Send call</h1>
                <div className='flex flex-col gap-5'>
                    <h1 className='text-xl font-light'>Phone numbers</h1>

                    <div className='flex gap-2 items-center w-full'>
                        <div className='flex items-center w-full  px-4 py-1 rounded-md border border-slate-150 gap-3'>
                            <label htmlFor="region">From:</label>
                           <input
                            type="text"
                            id="from"
                            value="+1(909) 992-0176"
                            placeholder="+1(909) 992-0176"
                            className="input input-bordered input-primary w-full px-3 py-1 max-w-xs"
                            disabled
                            />
                        </div>
                        <GoArrowSwitch size={30} color='black'/>
                        <div className='flex w-full  items-center px-4 py-1 rounded-md border border-slate-150 gap-3'>
                            <label htmlFor="region">To:</label>
                            <input
                            type="text"
                            id="to"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            placeholder="(941) 367-1234"
                                className="input input-bordered input-primary w-full px-3 py-1 max-w-xs"
                            />
                        </div>
                    </div>
                    <div className='flex flex-col gap-2'>
                        <h1 className='text-xl font-light'>Instruction</h1>
                        <textarea
                            name="instruction"
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder="Write your instruction here"
                            id="instruction"
                            cols="20"
                            rows="10"
                            className='border border-slate-150 h-24 rounded-md p-4'
                        ></textarea>
                    </div> 
                    <div className='flex flex-col gap-2'>
                        <h1 className='text-xl font-light'>Target</h1>
                        <input
                            type="text"
                            name='target'
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="Schedule an appointment with the client"
                            className="input input-bordered input-primary border w-full p-5 rounded-md"
                        />
                    </div> 
                    <div className='flex flex-col gap-2'>
                        <h1 className='text-xl font-light'>Emergency transfer number</h1>
                        <input
                            type="text"
                            name='transferNumber'
                            value={transferNumber}
                            onChange={(e) => setTransferNumber(e.target.value)}
                            placeholder="Transfer number"
                            className="input input-bordered input-primary border w-full p-5 rounded-md"
                        />
                    </div>
                    <button onClick={handleSendCall} className='flex items-center justify-center gap-1 bg-autocallblue text-white py-2 px-5 font-normal rounded-md focus:outline-none focus:shadow-outline'>
                        Send
                        <MdArrowOutward size={15} color='white'/>
                    </button>
                    <button onClick={handleTerminateCall} className='flex items-center justify-center gap-1 bg-red-500 text-white py-2 px-5 font-normal rounded-md focus:outline-none focus:shadow-outline'>
                        Terminate Call
                        <MdArrowOutward size={15} color='white'/>
                    </button>
                    
                </div>
            
            </div>
            <div className='flex flex-col gap-5 w-5/12 p-7'>
                <div className='flex justify-between items-center'>
                    <h1 className='text-3xl'>Conversation</h1>
                    {/* <Link href="/workflows">
                    <button className="flex items-center gap-2 bg-autocallblue text-white py-2 px-5 font-normal rounded-md focus:outline-none focus:shadow-outline">
                        Go to workflows
                        <CiSquareChevRight/>
                    </button>
                    </Link> */}
                </div>
            </div>
            </div>
        </div>
    );
}
