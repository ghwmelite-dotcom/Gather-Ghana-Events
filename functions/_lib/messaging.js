// Shared conversational intent router for chat channels (WhatsApp, Telegram).

export function intentReply(text, site) {
  const t = (text || '').trim().toLowerCase()
  if (/^\/?start|^hi|^hello|^akwaaba|help|menu/.test(t))
    return `Akwaaba! 🇬🇭 I'm the Gather Ghana assistant.\n• "plan" — start planning an event\n• "rsvp" — RSVP to an event\n• "pay" — send a gift / pay\n• "status" — your event updates\nOr visit ${site}`
  if (/rsvp/.test(t)) return `To RSVP, open your invite link and tap RSVP. Need help? ${site}/contact`
  if (/pay|gift|contribut|deposit/.test(t)) return `Send a gift or pay securely from the event page or your portal: ${site}/portal`
  if (/status|update|timeline/.test(t)) return `See your event timeline & payments in your client portal: ${site}/portal`
  if (/plan|book|quote|start/.test(t)) return `Let's plan your event! Start here: ${site}/book`
  return `I didn't quite get that. Try "plan", "rsvp", "pay", or "status" — or visit ${site}`
}
