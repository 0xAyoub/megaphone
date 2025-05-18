import { useState } from 'react'; // useEffect n'est pas utilisé
import { NavBarComponent } from './NavBarComponent';
import { CiCircleRemove, CiRoute, CiTrash, CiPhone, CiPlug1 } from "react-icons/ci";

export const MyAgentComponent = () => {
    const [isModalOpen, setIsModalOpen] = useState(false); // Ajout de l'état pour la pop-up

    const toggleModal = () => setIsModalOpen(!isModalOpen); // Fonction pour basculer la visibilité de la pop-up

    return (
        <div className='flex h-screen overflow-auto'>
            <NavBarComponent/>
            <div className='flex flex-col gap-5 w-full p-7'>
                <div className='flex justify-between'>
                    <h1 className='text-3xl'>My phone agents</h1>
                    <button 
                        className='flex bg-autocallblue items-center px-4 py-2 rounded-md text-white'
                        onClick={toggleModal} // Ajout de l'écouteur d'événement onClick
                    >
                        Create an agent
                    </button>
                </div>
                <div className='flex gap-5 w-full'>

                    <div className='flex flex-col gap-2 w-1/3 border border-gray-150 rounded-md p-5'>
                        <h2 className='text-2xl font-normal'>Inbound Workflow for Sales</h2>
                        <div className='flex items-center gap-3 p-3 border border-gray-150 rounded-md'>
                            <CiRoute/>
                            <p className='text-sm font-normal'>Inbound call workflow</p>
                        </div>
                        <div className='flex items-center gap-3 p-3 border border-gray-150 rounded-md'>
                            <CiPhone/>
                            <p className='text-sm font-normal'>+1234567890</p>
                        </div>
                        <div className='flex gap-2 items-center justify-between'>
                            <button className='flex w-fit bg-autocallblue px-4 py-2 rounded-md text-sm text-white'>Edit</button>
                            <button className='flex p-3'>
                            <CiTrash size={20}/>
                                </button>
                        </div>
                    </div>
                    

                </div>
            </div>
            {isModalOpen && ( // Condition pour afficher la pop-up
                <div className="absolute top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex justify-center items-center">
                    <div className="flex flex-col gap-5 bg-white w-96 p-9 rounded-lg">
                        <div className='flex justify-between'>
                            <h2 className='text-2xl'>Create a workflow</h2>
                            <button onClick={toggleModal}m> <CiCircleRemove size={20}/> </button>
                        </div>
                    
                        <div className='flex flex-col gap-1 w-full'>
                            <h1 className='text-base font-normal'>Name</h1>
                            <input type="text" placeholder="My first inbound call workflow" className='p-2 w-full border rounded-md' />
                        </div>
                        <div className='flex flex-col gap-1'>  
                            {/* <div className='flex flex-col gap-1 w-full'>
                                <label className='text-base font-normal'>Phone Number</label>
                                <select className='w-full p-2 border rounded-md'>
                                    <option value="+1234567890">+1234567890</option>
                                    <option value="+0987654321">+0987654321</option>
                                    <option value="+1122334455">+1122334455</option>
                                </select>
                            </div>
                            <div className='flex w-full justify-center'>
                                <CiPlug1 size={30}/>
                            </div> */}
                            <div className='flex flex-col gap-1 w-full'>
                                <label className='text-base font-normal'>Phone number</label>
                                <select className='w-full p-2 border rounded-md'>
                                    <option value="+1(909) 345-6789">+1(909) 345-6789</option>
                                    <option value="+1(909) 345-6789">+1(909) 345-6789</option>
                                </select>
                            </div>
                            <p className='pl-1 text-gray-400 text-xs'>A phone number cannot be linked 2 times in the same workflow. You need to edit existing workflows on a number or delete and recreate one. </p>
                        </div>
                        <div>
                            <button 
                                className='flex bg-autocallblue items-center px-4 py-2 rounded-md text-white'
                                onClick={toggleModal} // Ajout de l'écouteur d'événement onClick
                                >
                                Create workflow
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}