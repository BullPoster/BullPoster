import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getUserDashboard, joinRaid, updateEngagementScore } from '../utils/api';
import ProgramSearchEnrollment from './ProgramSearchEnrollment';

function UserDashboard() {
  const { publicKey } = useWallet();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEnrollment, setShowEnrollment] = useState(false);

  useEffect(() => {
    if (publicKey) {
      fetchUserData();
    }
  }, [publicKey]);

  const fetchUserData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserDashboard(publicKey.toBase58());
      setDashboardData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRaid = async (raidId) => {
    try {
      await joinRaid(raidId);
      fetchUserData(); // Refresh dashboard data
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateEngagementScore = async (participationId, newScore) => {
    try {
      await updateEngagementScore(participationId, { engagement_score: newScore });
      fetchUserData(); // Refresh dashboard data
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEnrollmentComplete = () => {
    fetchUserData(); // Refresh dashboard data after successful enrollment
    setShowEnrollment(false);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
    </div>;
  }

  if (error) {
    return <div className="text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      <OverallPerformance user={dashboardData.user} />
      <EarningsChart earningsHistory={dashboardData.earningsHistory} />
      <UserLeaderboard leaderboard={dashboardData.userLeaderboard} />
      <ProgramLeaderboard leaderboard={dashboardData.programLeaderboard} />
      <EnrolledPrograms 
        programs={dashboardData.enrolled_programs} 
        onEnrollClick={() => setShowEnrollment(true)}
      />
      {showEnrollment && (
        <ProgramSearchEnrollment onEnrollmentComplete={handleEnrollmentComplete} />
      )}
      <RaidCompetitionsSection 
        competitions={dashboardData.competitions} 
        onJoinRaid={handleJoinRaid}
      />
      <RaidsSection 
        raids={dashboardData.raids} 
        onJoinRaid={handleJoinRaid}
        onUpdateEngagementScore={handleUpdateEngagementScore}
      />
    </div>
  );
}


function OverallPerformance({ user }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">Overall Performance</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PerformanceCard title="Total Rewards" value={user.total_rewards} unit="SOL" />
        <PerformanceCard title="Participated Raids" value={user.participated_raids} />
        <PerformanceCard title="Raid Ranking" value={user.raid_ranking} />
        <PerformanceCard title="Engagement Score" value={user.engagement_score} />
        <PerformanceCard title="Streaks" value={user.streaks} />
      </div>
    </div>
  );
}

function PerformanceCard({ title, value, unit }) {
  return (
    <div className="bg-gray-700 p-4 rounded-lg">
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-2xl font-bold text-green-400">
        {value} {unit && <span className="text-sm text-gray-400">{unit}</span>}
      </p>
    </div>
  );
}

function EarningsChart({ earningsHistory }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">Earnings Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={earningsHistory}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="earnings" stroke="#2E9245" activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function UserLeaderboard({ leaderboard }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">User Leaderboard</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Rewards</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Engagement Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Streaks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {leaderboard.map((user, index) => (
              <tr key={user.public_key} className={index === 0 ? "bg-green-900 bg-opacity-50" : ""}>
                <td className="px-6 py-4 whitespace-nowrap">{index + 1}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.public_key ? `${user.public_key.slice(0, 4)}...${user.public_key.slice(-4)}` : 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{parseFloat(user.total_rewards).toFixed(2)} SOL</td>
                <td className="px-6 py-4 whitespace-nowrap">{parseFloat(user.engagement_score).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{user.streaks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProgramLeaderboard({ leaderboard }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">Program Leaderboard</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Program</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Participants</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Completed Raids</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Rewards</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {leaderboard.map((program, index) => (
              <tr key={program.id} className={index === 0 ? "bg-green-900 bg-opacity-50" : ""}>
                <td className="px-6 py-4 whitespace-nowrap">{index + 1}</td>
                <td className="px-6 py-4 whitespace-nowrap">{program.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{program.participants}</td>
                <td className="px-6 py-4 whitespace-nowrap">{program.completed_raids}</td>
                <td className="px-6 py-4 whitespace-nowrap">{parseFloat(program.total_rewards_distributed).toFixed(2)} SOL</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EnrolledPrograms({ programs, onEnrollClick }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">Enrolled Programs</h3>
      {programs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map(program => (
            <div key={program.program__id} className="bg-gray-700 p-4 rounded-lg">
              <h4 className="text-lg font-semibold text-white">{program.program__name}</h4>
              <p className="text-gray-300 text-sm">{program.program__description}</p>
              <p className="text-gray-400 text-sm mt-2">Size: {program.program__size}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-300">You're not enrolled in any programs yet.</p>
      )}
      <button 
        onClick={onEnrollClick}
        className="mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300"
      >
        Enroll in a Program
      </button>
    </div>
  );
}

function RaidCompetitionsSection({ competitions, onJoinRaid }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">Raid Competitions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {competitions.map((competition) => (
          <CompetitionCard 
            key={competition.id} 
            competition={competition} 
            onJoinRaid={onJoinRaid}
          />
        ))}
      </div>
    </div>
  );
}

function CompetitionCard({ competition, onJoinRaid }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'active': return 'green';
      case 'completed': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <div className={`bg-gray-700 rounded-lg p-4 border-2 border-${getStatusColor(competition.status)}-500 shadow-lg`}>
      <h4 className="text-lg font-semibold mb-2 text-green-400">{competition.type}</h4>
      <p className="text-sm text-gray-300 mb-1">Status: {competition.status}</p>
      <p className="text-sm text-gray-300 mb-1">Programs: {competition.enrolled_programs}/{competition.required_programs}</p>
      {competition.start_time && (
        <p className="text-sm text-gray-300 mb-2">
          Starts: {new Date(competition.start_time).toLocaleString()}
        </p>
      )}
      {competition.raids.map((raid) => (
        <div key={raid.id} className="mt-2 p-2 bg-gray-600 rounded">
          <p className="text-sm text-white">{raid.program_name}</p>
          <p className="text-xs text-gray-300">Reward Cap: {raid.reward_cap} SOL</p>
          <p className="text-xs text-gray-300">Participants: {raid.participants_count}</p>
          <button 
            onClick={() => onJoinRaid(raid.id)}
            className={`mt-1 w-full bg-${getStatusColor(competition.status)}-500 hover:bg-${getStatusColor(competition.status)}-600 text-white font-bold py-1 px-2 rounded text-sm`}
            disabled={competition.status !== 'pending'}
          >
            {competition.status === 'pending' ? 'Join Raid' : competition.status === 'active' ? 'In Progress' : 'Completed'}
          </button>
        </div>
      ))}
    </div>
  );
}

function RaidsSection({ raids, onJoinRaid, onUpdateEngagementScore }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">Raids</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {raids.map((raid) => (
          <RaidCard 
            key={raid.id} 
            raid={raid} 
            onJoinRaid={onJoinRaid}
            onUpdateEngagementScore={onUpdateEngagementScore}
          />
        ))}
      </div>
    </div>
  );
}

function RaidCard({ raid, onJoinRaid, onUpdateEngagementScore }) {
  const [newScore, setNewScore] = useState('');

  const handleUpdateScore = () => {
    onUpdateEngagementScore(raid.id, parseFloat(newScore));
    setNewScore('');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'active': return 'green';
      case 'completed': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <div className={`bg-gray-700 rounded-lg p-4 border-2 border-${getStatusColor(raid.status)}-500 shadow-lg`}>
      <h4 className="text-lg font-semibold mb-2 text-green-400">{raid.program_name}</h4>
      <p className="text-sm text-gray-300 mb-1">Status: {raid.status}</p>
      <p className="text-sm text-gray-300 mb-1">Reward Cap: {raid.reward_cap} SOL</p>
      <p className="text-sm text-gray-300 mb-1">Participants: {raid.participants_count}</p>
      <p className="text-sm text-gray-300 mb-2">
        {raid.start_time ? `Starts: ${new Date(raid.start_time).toLocaleString()}` : 'Start time: TBA'}
      </p>
      {raid.status === 'active' && (
        <div className="mt-2">
          <input
            type="number"
            value={newScore}
            onChange={(e) => setNewScore(e.target.value)}
            className="w-full p-2 mb-2 bg-gray-600 text-white rounded"
            placeholder="New engagement score"
          />
          <button 
            onClick={handleUpdateScore}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Update Score
          </button>
        </div>
      )}
      <button 
        onClick={() => onJoinRaid(raid.id)}
        className={`w-full mt-2 bg-${getStatusColor(raid.status)}-500 hover:bg-${getStatusColor(raid.status)}-600 text-white font-bold py-2 px-4 rounded`}
        disabled={raid.status !== 'pending'}
      >
        {raid.status === 'pending' ? 'Join Raid' : raid.status === 'active' ? 'In Progress' : 'Completed'}
      </button>
    </div>
  );
}

export default UserDashboard;