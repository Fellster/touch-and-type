export const TODO_PROMPTS = [
  "What do you need to do?",
  "Tell me what you want, what you really, really want...",
  "What's up, doc!",
  "Who are you? Who, who, who, who?",
  "The most effective way to do it, is to do it...",
  "I did it my way",
  "Don't stop me now, I'm having such a good time, I'm having a ball",
  "Carpe diem",
  "Do, or do not. There is no try",
  "Life moves pretty fast. If you don't stop and look around once in a while, you could miss it.",
  "You are what you do, not what you say you'll do.",
  "Do the best you can until you know better. Then when you know better, do better.",
  "Do the right thing.",
  "Do what you can, with what you have, where you are.",
  "The only way around is through.",
  "You can't go back and change the beginning, but you can start where you are and change the ending.",
  "Start where you are. Use what you have. Do what you can.",
  "Into the great wide open, under them skies of blue. Out in the great wide open, a rebel without a clue.",
  "High school days are gone. I'm a little bit older, a little bit wiser. I'm still trying to figure out what the hell went wrong",
  "Look, if you had one shot, or one opportunity to seize everything you ever wanted in one moment... would you capture it, or just let it slip?",
  "Who's next?",
  "Slow down, you're doing fine. You can't be everything you want to be before your time.",
  "Turn and face the strange. Ch-ch-changes. Just gonna have to be a different man.",
];

const KEY = "noted.todoPrompt.v1";

/** Picks a prompt once per browser session (i.e. per login/app open). */
export function getSessionTodoPrompt(): string {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  const pick = TODO_PROMPTS[Math.floor(Math.random() * TODO_PROMPTS.length)];
  try {
    sessionStorage.setItem(KEY, pick);
  } catch {
    /* ignore */
  }
  return pick;
}
