import { SlashCommandBuilder } from "discord.js"

export const data = new SlashCommandBuilder().setName("ping").setDescription("Check bot latency and status")

export async function execute(interaction) {
  try {
    const sent = await interaction.reply({ content: "🏓 Pinging...", fetchReply: true })
    const latency = sent.createdTimestamp - interaction.createdTimestamp
    const apiLatency = Math.round(interaction.client.ws.ping)

    await interaction.editReply({
      content: `🏓 **Pong!**\n📡 **Latency:** ${latency}ms\n💓 **API Latency:** ${apiLatency}ms\n✅ **Status:** Online`,
    })
  } catch (error) {
    console.error("Ping command error:", error)
    await interaction.reply({
      content: "❌ Error checking ping",
      ephemeral: true,
    })
  }
}
