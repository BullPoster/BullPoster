import { createCanvas, loadImage } from "canvas";

export const generateLeaderboardImage = async (stats: any) => {
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
  ctx.fillText("Leaderboard", width / 2, 50);

  // Stats
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  stats.forEach((stat: any, index: number) => {
    ctx.fillText(
      `${index + 1}. ${stat.name}: ${stat.value}`,
      50,
      100 + index * 30,
    );
  });

  // Convert canvas to image
  return canvas.toDataURL();
};
