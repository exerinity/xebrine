export const PROFANITY_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'cock',
  'pussy',
  'cunt',
  'nigger',
  'nigga',
  'whore',
  'slut',
  'faggot',
  'motherfucker'
];

const PROFANITY_PATTERN = new RegExp(`\\b(${PROFANITY_WORDS.join('|')})\\w*`, 'i');

export function containsProfanity(text) {
  return PROFANITY_PATTERN.test(text);
}
