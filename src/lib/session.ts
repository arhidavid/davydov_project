// Anonymous, per-device identity persisted in localStorage. No accounts needed —
// perfect for "scan a QR code and instantly join from your phone" flows.

const SESSION_KEY = "cp.sessionId";
const NAME_KEY = "cp.name";
const EMOJI_KEY = "cp.emoji";

export const EMOJIS = ["🦊", "🐸", "🐙", "🐳", "🦄", "🐝", "🦖", "🐼", "🐧", "🦁", "👾", "🤖"];

const ADJECTIVES = ["Swift", "Brave", "Chill", "Turbo", "Cosmic", "Sneaky", "Mighty", "Jolly"];
const NOUNS = ["Otter", "Comet", "Pixel", "Ninja", "Mango", "Falcon", "Yeti", "Waffle"];

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getName(): string {
  let name = localStorage.getItem(NAME_KEY);
  if (!name) {
    name = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
    localStorage.setItem(NAME_KEY, name);
  }
  return name;
}

export function setName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}

export function getEmoji(): string {
  let emoji = localStorage.getItem(EMOJI_KEY);
  if (!emoji) {
    emoji = pick(EMOJIS);
    localStorage.setItem(EMOJI_KEY, emoji);
  }
  return emoji;
}

export function setEmoji(emoji: string): void {
  localStorage.setItem(EMOJI_KEY, emoji);
}
