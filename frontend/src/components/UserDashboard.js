import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { joinRaid } from "../utils/api";
import {
  getUserCard,
  getProgramState,
  getProgramRaidProgramsState,
  getProgramRaidsState,
  getProgramCompetitionsState,
  getLeaderboard,
  fetchRaidProgramData,
  fetchRaidData,
} from "../utils/solanaUtils";
import ProgramSearchEnrollment from "./ProgramSearchEnrollment";
import BlinkCard from "./BlinkCard";

function UserDashboard() {
  const { publicKey, signTransaction } = useWallet();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEnrollment, setShowEnrollment] = useState(false);

  useEffect(() => {
    if (publicKey) {
      fetchUserData();
    }
  }, [publicKey]);

  const calculateUserRewards = async (userCard) => {
    let totalRewards = 0;
    const earningsHistory = [];
    const enrolledProgramIds = userCard.enrolled_programs
      .split(",")
      .filter(Boolean);

    for (const programId of enrolledProgramIds) {
      const raidProgramData = await fetchRaidProgramData(programId);
      const raidIds = raidProgramData.raids.split(",").filter(Boolean);

      for (const raidId of raidIds) {
        const raidData = await fetchRaidData(raidId);
        const distributedRewards = JSON.parse(raidData.distributed_rewards);

        if (distributedRewards[publicKey.toBase58()]) {
          const rewardAmount = parseFloat(
            distributedRewards[publicKey.toBase58()],
          );
          totalRewards += rewardAmount;

          earningsHistory.push({
            date: new Date(raidData.end_time * 1000).toISOString(),
            earnings: rewardAmount,
            raidId: raidId,
            programId: programId,
          });
        }
      }
    }

    return {
      totalRewards,
      earningsHistory: earningsHistory.sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      ),
    };
  };

  const fetchUserData = async () => {
    try {
      const userCard = await getUserCard(publicKey);
      console.log("Raw userCard data:", userCard);
      const programState = await getProgramState();
      const raidProgramsState = await getProgramRaidProgramsState();
      const raidsState = await getProgramRaidsState();
      const competitionsState = await getProgramCompetitionsState();
      const leaderboardState = await getLeaderboard();
      // Parse enrolled program IDs
      const enrolledProgramIds = userCard.enrolled_programs
        ? userCard.enrolled_programs.split(",").filter(Boolean)
        : [];

      // Parse raid programs
      const raidPrograms = raidProgramsState.raid_program_pubkeys
        ? raidProgramsState.raid_program_pubkeys.split(",").filter(Boolean)
        : [];

      // Determine available programs
      const availablePrograms = raidPrograms.filter(
        (programId) => !enrolledProgramIds.includes(programId),
      );

      // Calculate rewards and earnings history
      const { totalRewards, earningsHistory } =
        await calculateUserRewards(userCard);

      // Parse raids
      const raids = raidsState.raid_pubkeys
        ? raidsState.raid_pubkeys.split(",").filter(Boolean)
        : [];

      // Parse competitions
      const competitions = competitionsState.competition_pubkeys
        ? competitionsState.competition_pubkeys.split(",").filter(Boolean)
        : [];

      // Parse leaderboard data
      const parsedLeaderboard = leaderboardState.leaderboard_data
        ? JSON.parse(leaderboardState.leaderboard_data)
        : { users: [], programs: [] };

      setDashboardData({
        user: {
          ...userCard,
          totalRewards,
        },
        raidHistory: earningsHistory,
        raids,
        competitions,
        leaderboard: parsedLeaderboard,
        earningsHistory,
        raidPrograms,
        enrolled_programs: enrolledProgramIds,
        availablePrograms,
      });

      // Add these console.log statements
      console.log("User data:", userCard);
      console.log("Total Rewards:", totalRewards);
      console.log("Raid history:", earningsHistory);
      console.log("Raids:", raids);
      console.log("Competitions:", competitions);
      console.log("Leaderboard:", parsedLeaderboard);
      console.log("Earnings history:", earningsHistory);
      console.log("Enrolled programs:", enrolledProgramIds);
      console.log("Available programs:", availablePrograms);

      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching user data:", error);
      setError("Failed to fetch user data");
      setIsLoading(false);
    }
  };

  const handleEnrollmentComplete = async (programId) => {
    try {
      await fetchUserData(); // Refresh data after successful enrollment
      setShowEnrollment(false);
    } catch (err) {
      console.error("Error after enrolling in program:", err);
      setError(err.message);
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500">Error: {error}</div>;
  }

  let overallPerformanceComponent,
    earningsChartComponent,
    userLeaderboardComponent,
    programLeaderboardComponent,
    enrolledProgramsComponent,
    programSearchEnrollmentComponent,
    raidCompetitionsSectionComponent,
    raidsSectionComponent;

  try {
    console.log("Rendering OverallPerformance with:", dashboardData.user);
    overallPerformanceComponent = (
      <OverallPerformance user={dashboardData.user} />
    );
  } catch (error) {
    console.error("Error in OverallPerformance:", error);
    overallPerformanceComponent = <div>Error rendering OverallPerformance</div>;
  }

  try {
    console.log("Rendering EarningsChart with:", dashboardData.earningsHistory);
    earningsChartComponent = (
      <EarningsChart earningsHistory={dashboardData.earningsHistory} />
    );
  } catch (error) {
    console.error("Error in EarningsChart:", error);
    earningsChartComponent = <div>Error rendering EarningsChart</div>;
  }

  try {
    console.log(
      "Rendering UserLeaderboard with:",
      dashboardData.leaderboard.users,
    );
    userLeaderboardComponent = (
      <UserLeaderboard leaderboard={dashboardData.leaderboard.users} />
    );
  } catch (error) {
    console.error("Error in UserLeaderboard:", error);
    userLeaderboardComponent = <div>Error rendering UserLeaderboard</div>;
  }

  try {
    console.log(
      "Rendering ProgramLeaderboard with:",
      dashboardData.leaderboard.programs,
    );
    programLeaderboardComponent = (
      <ProgramLeaderboard leaderboard={dashboardData.leaderboard.programs} />
    );
  } catch (error) {
    console.error("Error in ProgramLeaderboard:", error);
    programLeaderboardComponent = <div>Error rendering ProgramLeaderboard</div>;
  }

  try {
    console.log("Rendering EnrolledPrograms with:", {
      enrolled_programs: dashboardData.enrolled_programs,
      availablePrograms: dashboardData.availablePrograms,
    });
    enrolledProgramsComponent = (
      <EnrolledPrograms
        programs={dashboardData.enrolled_programs}
        allPrograms={dashboardData.availablePrograms}
        onEnrollClick={() => setShowEnrollment(true)}
      />
    );
  } catch (error) {
    console.error("Error in EnrolledPrograms:", error);
    enrolledProgramsComponent = <div>Error rendering EnrolledPrograms</div>;
  }

  if (showEnrollment) {
    try {
      programSearchEnrollmentComponent = (
        <ProgramSearchEnrollment
          availablePrograms={dashboardData.availablePrograms}
          onEnrollmentComplete={handleEnrollmentComplete}
        />
      );
    } catch (error) {
      console.error("Error in ProgramSearchEnrollment:", error);
      programSearchEnrollmentComponent = (
        <div>Error rendering ProgramSearchEnrollment</div>
      );
    }
  }

  try {
    console.log(
      "Rendering RaidCompetitionsSection with:",
      dashboardData.competitions,
    );
    raidCompetitionsSectionComponent = (
      <RaidCompetitionsSection
        competitions={dashboardData.competitions}
        onJoinRaid={handleJoinRaid}
      />
    );
  } catch (error) {
    console.error("Error in RaidCompetitionsSection:", error);
    raidCompetitionsSectionComponent = (
      <div>Error rendering RaidCompetitionsSection</div>
    );
  }

  try {
    console.log("Rendering RaidsSection with:", dashboardData.raids);
    raidsSectionComponent = (
      <RaidsSection raids={dashboardData.raids} onJoinRaid={handleJoinRaid} />
    );
  } catch (error) {
    console.error("Error in RaidsSection:", error);
    raidsSectionComponent = <div>Error rendering RaidsSection</div>;
  }

  return (
    <div className="space-y-8">
      {overallPerformanceComponent}
      {earningsChartComponent}
      {userLeaderboardComponent}
      {programLeaderboardComponent}
      {enrolledProgramsComponent}
      {programSearchEnrollmentComponent}
      {raidCompetitionsSectionComponent}
      {raidsSectionComponent}
    </div>
  );
}

function OverallPerformance({ user }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">
        Overall Performance
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PerformanceCard
          title="Total Rewards"
          value={user.totalRewards || 0}
          unit="SOL"
        />
        <PerformanceCard
          title="Participated Raids"
          value={user.participated_raids || 0}
        />
        <PerformanceCard title="Raid Ranking" value={user.raid_ranking || 0} />
        <PerformanceCard
          title="Engagement Score"
          value={user.engagement_score || 0}
        />
        <PerformanceCard title="Streaks" value={user.streaks || 0} />
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
  if (!earningsHistory || earningsHistory.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-green-400">
          Earnings Over Time
        </h3>
        <p className="text-gray-300">No earnings data available yet.</p>
      </div>
    );
  }

  const chartData = earningsHistory.map((entry) => ({
    date: new Date(entry.date).toLocaleDateString(),
    earnings: entry.earnings,
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">
        Earnings Over Time
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="earnings"
            stroke="#2E9245"
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function UserLeaderboard({ leaderboard }) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-green-400">
          User Leaderboard
        </h3>
        <p className="text-gray-300">No leaderboard data available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">
        User Leaderboard
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Total Rewards
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Engagement Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Streaks
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {leaderboard.map((user, index) => (
              <tr
                key={user.public_key}
                className={index === 0 ? "bg-green-900 bg-opacity-50" : ""}
              >
                <td className="px-6 py-4 whitespace-nowrap">{index + 1}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.public_key
                    ? `${user.public_key.slice(0, 4)}...${user.public_key.slice(-4)}`
                    : "Unknown"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {parseFloat(user.total_rewards || 0).toFixed(2)} SOL
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {parseFloat(user.engagement_score || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.streaks || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProgramLeaderboard({ leaderboard }) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-green-400">
          Program Leaderboard
        </h3>
        <p className="text-gray-300">No leaderboard data available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">
        Program Leaderboard
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Program
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Participants
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Completed Raids
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Total Rewards
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {leaderboard.map((program, index) => (
              <tr
                key={program.id}
                className={index === 0 ? "bg-green-900 bg-opacity-50" : ""}
              >
                <td className="px-6 py-4 whitespace-nowrap">{index + 1}</td>
                <td className="px-6 py-4 whitespace-nowrap">{program.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {program.participants || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {program.completed_raids || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {parseFloat(program.total_rewards_distributed || 0).toFixed(
                    2,
                  )}{" "}
                  SOL
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EnrolledPrograms({ programs, allPrograms, onEnrollClick }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">
        Enrolled Programs
      </h3>
      {programs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((program) => (
            <div
              key={program.program__id}
              className="bg-gray-700 p-4 rounded-lg"
            >
              <h4 className="text-lg font-semibold text-white">
                {program.program__name}
              </h4>
              <p className="text-gray-300 text-sm">
                {program.program__description}
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Size: {program.program__size}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-300">
          You're not enrolled in any programs yet.
        </p>
      )}
      {allPrograms.length > programs.length && (
        <button
          onClick={onEnrollClick}
          className="mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300"
        >
          Enroll in a Program
        </button>
      )}
    </div>
  );
}

function RaidCompetitionsSection({ competitions, onJoinRaid }) {
  if (!competitions || competitions.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-green-400">
          Raid Competitions
        </h3>
        <p className="text-gray-300">No active competitions at the moment.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">
        Raid Competitions
      </h3>
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
      case "pending":
        return "yellow";
      case "active":
        return "green";
      case "completed":
        return "gray";
      default:
        return "gray";
    }
  };

  return (
    <div
      className={`bg-gray-700 rounded-lg p-4 border-2 border-${getStatusColor(competition.status)}-500 shadow-lg`}
    >
      <h4 className="text-lg font-semibold mb-2 text-green-400">
        {competition.type}
      </h4>
      <p className="text-sm text-gray-300 mb-1">Status: {competition.status}</p>
      <p className="text-sm text-gray-300 mb-1">
        Programs: {competition.enrolled_programs || 0}/
        {competition.required_programs || 0}
      </p>
      {competition.start_time && (
        <p className="text-sm text-gray-300 mb-2">
          Starts: {new Date(competition.start_time).toLocaleString()}
        </p>
      )}
      {competition.raids && competition.raids.length > 0 ? (
        competition.raids.map((raid) => (
          <div key={raid.id} className="mt-2 p-2 bg-gray-600 rounded">
            <p className="text-sm text-white">{raid.program_name}</p>
            <p className="text-xs text-gray-300">
              Reward Cap: {raid.reward_cap || 0} SOL
            </p>
            <p className="text-xs text-gray-300">
              Participants: {raid.participants_count || 0}
            </p>
            <button
              onClick={() => onJoinRaid(raid.id)}
              className={`mt-1 w-full bg-${getStatusColor(competition.status)}-500 hover:bg-${getStatusColor(competition.status)}-600 text-white font-bold py-1 px-2 rounded text-sm`}
              disabled={competition.status !== "pending"}
            >
              {competition.status === "pending"
                ? "Join Raid"
                : competition.status === "active"
                  ? "In Progress"
                  : "Completed"}
            </button>
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-300 mt-2">
          No raids in this competition yet.
        </p>
      )}
    </div>
  );
}

function RaidsSection({ raids, onJoinRaid }) {
  if (!raids || raids.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-green-400">Raids</h3>
        <p className="text-gray-300">No active raids at the moment.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-4 text-green-400">Raids</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {raids.map((raid) => (
          <RaidCard key={raid.id} raid={raid} onJoinRaid={onJoinRaid} />
        ))}
      </div>
    </div>
  );
}

function RaidCard({ raid, onJoinRaid }) {
  const [newScore, setNewScore] = useState("");
  const actionApiUrl = `https://bullposter.xyz/actions/raid-card?raidId=${raid.id}`;

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "yellow";
      case "active":
        return "green";
      case "completed":
        return "gray";
      default:
        return "gray";
    }
  };

  return (
    <div
      className={`bg-gray-700 rounded-lg p-4 border-2 border-${getStatusColor(raid.status)}-500 shadow-lg`}
    >
      <h4 className="text-lg font-semibold mb-2 text-green-400">
        {raid.program_name || "Unnamed Raid"}
      </h4>
      <p className="text-sm text-gray-300 mb-1">
        Status: {raid.status || "Unknown"}
      </p>
      <p className="text-sm text-gray-300 mb-1">
        Reward Cap: {raid.reward_cap || 0} SOL
      </p>
      <p className="text-sm text-gray-300 mb-1">
        Participants: {raid.participants_count || 0}
      </p>
      <p className="text-sm text-gray-300 mb-2">
        {raid.start_time
          ? `Starts: ${new Date(raid.start_time).toLocaleString()}`
          : "Start time: TBA"}
      </p>
      {raid.status === "active" && (
        <div className="mt-2">
          <input
            type="number"
            value={newScore}
            onChange={(e) => setNewScore(e.target.value)}
            className="w-full p-2 mb-2 bg-gray-600 text-white rounded"
            placeholder="New engagement score"
          />
        </div>
      )}
      <button
        onClick={() => onJoinRaid(raid.id)}
        className={`w-full mt-2 bg-${getStatusColor(raid.status)}-500 hover:bg-${getStatusColor(raid.status)}-600 text-white font-bold py-2 px-4 rounded`}
        disabled={raid.status !== "pending"}
      >
        {raid.status === "pending"
          ? "Join Raid"
          : raid.status === "active"
            ? "In Progress"
            : "Completed"}
      </button>
      {raid.status === "active" && (
        <div className="mt-4">
          <BlinkCard actionApiUrl={actionApiUrl} />
          <div className="mt-2">
            <input
              type="text"
              value={actionApiUrl}
              readOnly
              className="w-full p-2 bg-gray-600 text-white rounded"
            />
            <button
              onClick={() => navigator.clipboard.writeText(actionApiUrl)}
              className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
            >
              Copy URL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
