import React from 'react';

function DashboardToggle({ activeDashboard, setActiveDashboard, hasPresaleAccess }) {
  return (
    <div className="flex space-x-4">
      <button
        onClick={() => setActiveDashboard('user')}
        className={`px-4 py-2 rounded-full transition duration-300 ${
          activeDashboard === 'user'
            ? 'bg-green-500 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        User Dashboard
      </button>
      <button
        onClick={() => setActiveDashboard('creator')}
        className={`px-4 py-2 rounded-full transition duration-300 ${
          activeDashboard === 'creator'
            ? 'bg-green-500 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        Creator Dashboard
      </button>
      {hasPresaleAccess && (
        <button
          onClick={() => setActiveDashboard('presale')}
          className={`px-4 py-2 rounded-full transition duration-300 ${
            activeDashboard === 'presale'
              ? 'bg-green-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Pre-sale
        </button>
      )}
      <button
        onClick={() => setActiveDashboard('profile')}
        className={`px-4 py-2 rounded-full transition duration-300 ${
          activeDashboard === 'profile'
            ? 'bg-green-500 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        Profile
      </button>
    </div>
  );
}

export default DashboardToggle