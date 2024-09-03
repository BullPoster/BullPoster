import React, { useState, useEffect } from 'react';
import { getAvailablePrograms, enrollInProgram } from '../utils/api';

function ProgramSearchEnrollment({ onEnrollmentComplete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [programs, setPrograms] = useState([]);
  const [filteredPrograms, setFilteredPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const programsPerPage = 5;

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    if (Array.isArray(programs)) {
      const filtered = programs.filter(program => 
        program.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPrograms(filtered);
      setCurrentPage(1);
    }
  }, [searchTerm, programs]);

  const fetchPrograms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAvailablePrograms();
      if (Array.isArray(data.programs)) {
        setPrograms(data.programs);
        setFilteredPrograms(data.programs);
      } else {
        console.error('Received invalid data format:', data);
        setError('Received invalid data from the server');
      }
    } catch (err) {
      console.error('Failed to fetch programs:', err);
      setError('Failed to fetch programs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectProgram = (program) => {
    setSelectedProgram(program);
  };

  const handleEnroll = async () => {
    if (!selectedProgram) return;

    setIsEnrolling(true);
    setError(null);

    try {
      await enrollInProgram(selectedProgram.id);
      onEnrollmentComplete();
    } catch (err) {
      console.error('Failed to enroll in program:', err);
      setError('Failed to enroll in the program. Please try again.');
    } finally {
      setIsEnrolling(false);
    }
  };

  const indexOfLastProgram = currentPage * programsPerPage;
  const indexOfFirstProgram = indexOfLastProgram - programsPerPage;
  const currentPrograms = filteredPrograms.slice(indexOfFirstProgram, indexOfLastProgram);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (isLoading) {
    return <div className="text-center">Loading programs...</div>;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">Enroll in a Program</h3>
      <input
        type="text"
        placeholder="Search for programs..."
        value={searchTerm}
        onChange={handleSearch}
        className="w-full p-2 mb-4 bg-gray-700 text-white rounded"
      />
      <div className="space-y-4 mb-4">
		{currentPrograms.map(program => (
          <div 
            key={program.id} 
            className={`p-4 rounded-lg cursor-pointer ${selectedProgram && selectedProgram.id === program.id ? 'bg-green-600' : 'bg-gray-700'}`}
            onClick={() => handleSelectProgram(program)}
          >
            <h4 className="text-lg font-semibold text-white">{program.name}</h4>
            <p className="text-sm text-gray-300">{program.description}</p>
            <p className="text-sm text-gray-400 mt-2">Size: {program.size}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-center space-x-2 mb-4">
        {Array.from({ length: Math.ceil(filteredPrograms.length / programsPerPage) }, (_, i) => (
          <button
            key={i}
            onClick={() => paginate(i + 1)}
            className={`px-3 py-1 rounded ${currentPage === i + 1 ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <button 
        onClick={handleEnroll}
        disabled={!selectedProgram || isEnrolling}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300 disabled:opacity-50"
      >
        {isEnrolling ? 'Enrolling...' : 'Enroll in Selected Program'}
      </button>
    </div>
  );
}

export default ProgramSearchEnrollment;