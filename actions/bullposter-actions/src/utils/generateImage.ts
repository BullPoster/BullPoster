import { createCanvas, loadImage } from "canvas";

export const generateCardImage = async (cardType: string, data: any) => {
  const width = 800;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = "#2E9245";
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#2E9245";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";

  // Load profile picture if available
  let profilePicture;
  if (data.profilePicture) {
    profilePicture = await loadImage(data.profilePicture);
  }

  switch (cardType) {
    case "UserCard":
      ctx.fillText("User Profile", width / 2, 50);
      if (profilePicture) {
        ctx.drawImage(profilePicture, 50, 100, 100, 100);
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.textAlign = "left";
      ctx.fillText(`Username: ${data.username}`, 200, 150);
      ctx.fillText(`Total Rewards: ${data.totalRewards}`, 200, 180);
      ctx.fillText(`Participated Raids: ${data.participatedRaids}`, 200, 210);
      ctx.fillText(`Engagement Score: ${data.engagementScore}`, 200, 240);
      break;

    case "LeaderboardCard":
      ctx.fillText("Leaderboard", width / 2, 50);
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.textAlign = "left";
      data.stats.forEach((stat: any, index: number) => {
        ctx.fillText(
          `${index + 1}. ${stat.name}: ${stat.value}`,
          50,
          100 + index * 30,
        );
      });
      break;

    case "RaidCard":
      ctx.fillText("Raid Card", width / 2, 50);
      if (profilePicture) {
        ctx.drawImage(profilePicture, 50, 100, 100, 100);
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.textAlign = "left";
      ctx.fillText(`Program: ${data.programName}`, 50, 100);
      ctx.fillText(`Reward Cap: ${data.rewardCap}`, 50, 130);
      ctx.fillText(`Participants: ${data.participantsCount}`, 50, 160);
      break;

    case "ProgramCard":
      ctx.fillText("Program Card", width / 2, 50);
      if (profilePicture) {
        ctx.drawImage(profilePicture, 50, 100, 100, 100);
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.textAlign = "left";
      ctx.fillText(`Program Name: ${data.programName}`, 200, 150);
      ctx.fillText(
        `Total Rewards Distributed: ${data.totalRewardsDistributed}`,
        200,
        180,
      );
      ctx.fillText(`Size: ${data.size}`, 200, 210);
      break;

    default:
      throw new Error("Invalid card type");
  }

  // Convert canvas to image
  return canvas.toDataURL();
};
