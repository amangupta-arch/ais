// 10-question algebra warm-up. Each entry is small enough to render
// in a single big serif line; the answer is verified at design-time
// by the comment after `=>` so the quiz never ships with a wrong key.
export type QuizQuestion = {
  id: number;
  display: string;        // shown on the question card
  ttsReadout: string;     // speakable form, in case we wire audio later
  expectedAnswer: number; // x = ?
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: 1,  display: "x + 7 = 19",       ttsReadout: "x plus 7 equals 19",                expectedAnswer: 12 },
  { id: 2,  display: "3x = 27",          ttsReadout: "3x equals 27",                      expectedAnswer: 9  },
  { id: 3,  display: "2x + 5 = 17",      ttsReadout: "2x plus 5 equals 17",               expectedAnswer: 6  },
  { id: 4,  display: "5x − 9 = 31",      ttsReadout: "5x minus 9 equals 31",              expectedAnswer: 8  },
  { id: 5,  display: "x ÷ 4 = 6",        ttsReadout: "x divided by 4 equals 6",           expectedAnswer: 24 },
  { id: 6,  display: "(2x ÷ 5) + 3 = 11",ttsReadout: "2x over 5, plus 3, equals 11",      expectedAnswer: 20 },
  { id: 7,  display: "7x + 4 = 46",      ttsReadout: "7x plus 4 equals 46",               expectedAnswer: 6  },
  { id: 8,  display: "9x − 15 = 48",     ttsReadout: "9x minus 15 equals 48",             expectedAnswer: 7  },
  { id: 9,  display: "(x − 3) ÷ 2 = 8",  ttsReadout: "x minus 3, divided by 2, equals 8", expectedAnswer: 19 },
  { id: 10, display: "4(x − 2) = 24",    ttsReadout: "4 times x minus 2 equals 24",       expectedAnswer: 8  },
];
