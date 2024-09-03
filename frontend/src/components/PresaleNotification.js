import React from 'react';

const PresaleNotification = ({ onAccessClick }) => {
  return (
    <div className="bg-green text-black py-2 px-4 mb-4">
      <div className="max-w-4xl mx-auto flex justify-center items-center">
        <span className="font-bold mr-2">Pre-sale is now live!</span>
        <button 
          onClick={onAccessClick} 
          className="text-black font-semibold hover:underline focus:outline-none"
        >
          Access Now
        </button>
      </div>
    </div>
  );
};

export default PresaleNotification;