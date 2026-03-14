// South African Curricula and Subjects Data

export type Curriculum = 'caps' | 'ieb' | 'cambridge';
export type Grade = '8' | '9' | '10' | '11' | '12';
export type CurriculumEnum = 'CAPS' | 'IEB' | 'Cambridge';

export interface CurriculumInfo {
  id: Curriculum;
  name: string;
  description: string;
  icon: string;
}

export const CURRICULA: Record<Curriculum, CurriculumInfo> = {
  caps: {
    id: 'caps',
    name: 'CAPS (DBE)',
    description: 'Curriculum and Assessment Policy Statement - Department of Basic Education',
    icon: '🇿🇦',
  },
  ieb: {
    id: 'ieb',
    name: 'IEB',
    description: 'Independent Examinations Board',
    icon: '📝',
  },
  cambridge: {
    id: 'cambridge',
    name: 'Cambridge',
    description: 'Cambridge International Examinations',
    icon: '🇬🇧',
  },
};

export const GRADES: Grade[] = ['8', '9', '10', '11', '12'];

// Common SA languages for grades 8 & 9
const SA_HOME_LANGUAGES = [
  'English Home Language',
  'Afrikaans Home Language',
  'isiZulu Home Language',
  'isiXhosa Home Language',
  'isiNdebele Home Language',
  'Sesotho Home Language',
  'Setswana Home Language',
  'Sepedi Home Language',
  'Siswati Home Language',
  'Xitsonga Home Language',
  'Tshivenda Home Language',
];

const SA_FAL = [
  'English First Additional Language',
  'Afrikaans First Additional Language',
  'isiZulu First Additional Language',
  'isiXhosa First Additional Language',
  'isiNdebele First Additional Language',
  'Sesotho First Additional Language',
  'Setswana First Additional Language',
  'Sepedi First Additional Language',
  'Siswati First Additional Language',
  'Xitsonga First Additional Language',
  'Tshivenda First Additional Language',
];

const SA_SAL = [
  'English Second Additional Language',
  'Afrikaans Second Additional Language',
  'isiZulu Second Additional Language',
  'isiXhosa Second Additional Language',
  'isiNdebele Second Additional Language',
  'Sesotho Second Additional Language',
  'Setswana Second Additional Language',
  'Sepedi Second Additional Language',
  'Siswati Second Additional Language',
  'Xitsonga Second Additional Language',
  'Tshivenda Second Additional Language',
];

const INTERNATIONAL_LANGUAGES = [
  'German',
  'French',
  'Spanish',
  'Mandarin Chinese',
  'Arabic',
];

const CAPS_FET_ELECTIVES = [
  // Core
  'Mathematics',
  'Mathematical Literacy',
  'Life Sciences',
  'Physical Sciences',
  'Life Orientation',
  // Humanities
  'Geography',
  'History',
  'Religion Studies',
  // Commerce
  'Accounting',
  'Business Studies',
  'Economics',
  // Technology
  'Engineering Graphics and Design',
  'Computer Applications Technology',
  'Information Technology',
  'Technology',
  // Technical
  'Technical Mathematics',
  'Technical Sciences',
  'Civil Technology',
  'Electrical Technology',
  'Mechanical Technology',
  // Hospitality & Tourism
  'Tourism',
  'Hospitality Studies',
  'Consumer Studies',
  // Agriculture
  'Agricultural Sciences',
  'Agricultural Technology',
  'Agricultural Management Practices',
  // Creative Arts
  'Visual Arts',
  'Design',
  'Dramatic Arts',
  'Music',
  'Dance Studies',
  // Niche & Specialized
  'Sports and Exercise Science',
  'Nautical Science',
  'Equine Studies',
  'Maritime Economics',
  'South African Sign Language (Home Language)',
];

// CAPS (DBE) Subjects
const CAPS_SUBJECTS: Record<Grade, string[]> = {
  '8': [
    ...SA_HOME_LANGUAGES,
    ...SA_FAL,
    ...SA_SAL,
    'Mathematics',
    'Natural Sciences',
    'Social Sciences',
    'Technology',
    'Life Orientation',
    'Physical Education',
    'Visual Arts',
    'Music',
    'Drama',
    'Economic and Management Sciences',
  ],
  '9': [
    ...SA_HOME_LANGUAGES,
    ...SA_FAL,
    ...SA_SAL,
    'Mathematics',
    'Natural Sciences',
    'Social Sciences',
    'Technology',
    'Life Orientation',
    'Physical Education',
    'Visual Arts',
    'Music',
    'Drama',
    'Economic and Management Sciences',
  ],
  '10': [
    ...SA_HOME_LANGUAGES,
    ...SA_FAL,
    ...SA_SAL,
    ...INTERNATIONAL_LANGUAGES,
    ...CAPS_FET_ELECTIVES,
  ],
  '11': [
    ...SA_HOME_LANGUAGES,
    ...SA_FAL,
    ...SA_SAL,
    ...INTERNATIONAL_LANGUAGES,
    ...CAPS_FET_ELECTIVES,
  ],
  '12': [
    ...SA_HOME_LANGUAGES,
    ...SA_FAL,
    ...SA_SAL,
    ...INTERNATIONAL_LANGUAGES,
    ...CAPS_FET_ELECTIVES,
  ],
};

// IEB Subjects
const IEB_LANGUAGES_SENIOR = [
  'English Home Language',
  'English First Additional Language',
  'English Second Additional Language',
  'Afrikaans Home Language',
  'Afrikaans First Additional Language',
  'Afrikaans Second Additional Language',
  'isiZulu Home Language',
  'isiZulu First Additional Language',
  'isiZulu Second Additional Language',
  'isiXhosa Home Language',
  'isiXhosa First Additional Language',
  'isiXhosa Second Additional Language',
  'Sesotho Home Language',
  'Sesotho First Additional Language',
  'Sesotho Second Additional Language',
  'Setswana Home Language',
  'Setswana First Additional Language',
  'Sepedi Home Language',
  'Sepedi First Additional Language',
  'Siswati Home Language',
  'Xitsonga Home Language',
  'Tshivenda Home Language',
  'German',
  'French',
  'Spanish',
  'Portuguese',
  'Latin',
  'Hebrew',
  'Mandarin Chinese',
  'Italian',
  'Greek',
  'Gujarati',
  'Hindi',
  'Tamil',
  'Telegu',
  'Urdu',
  'Arabic',
  'South African Sign Language',
];

const IEB_SUBJECTS: Record<Grade, string[]> = {
  '8': [
    'English Home Language',
    'Afrikaans Home Language',
    'isiZulu Home Language',
    'isiXhosa Home Language',
    'Mathematics',
    'Sciences',
    'Social Sciences',
    'Life Orientation',
    'Technology',
    'Visual Arts',
    'Music',
    'Drama',
    'Economic and Management Sciences',
  ],
  '9': [
    'English Home Language',
    'Afrikaans Home Language',
    'isiZulu Home Language',
    'isiXhosa Home Language',
    'Mathematics',
    'Sciences',
    'Social Sciences',
    'Life Orientation',
    'Technology',
    'Visual Arts',
    'Music',
    'Drama',
    'Economic and Management Sciences',
  ],
  '10': [
    ...IEB_LANGUAGES_SENIOR,
    'Mathematics',
    'Mathematical Literacy',
    'Life Orientation',
    'Life Sciences',
    'Physical Sciences',
    'Earth Sciences',
    'Marine Sciences',
    'Accounting',
    'Business Studies',
    'Economics',
    'Computer Applications Technology',
    'Information Technology',
    'Geography',
    'History',
    'Religion Studies',
    'Social Sciences',
    'Design',
    'Dramatic Arts',
    'Visual Arts',
    'Music',
    'Dance',
    'Consumer Studies',
    'Hospitality Studies',
    'Tourism',
    'Engineering Graphics and Design',
    'Agricultural Sciences',
  ],
  '11': [
    ...IEB_LANGUAGES_SENIOR,
    'Mathematics',
    'Mathematical Literacy',
    'Life Orientation',
    'Life Sciences',
    'Physical Sciences',
    'Earth Sciences',
    'Marine Sciences',
    'Accounting',
    'Business Studies',
    'Economics',
    'Computer Applications Technology',
    'Information Technology',
    'Geography',
    'History',
    'Religion Studies',
    'Social Sciences',
    'Design',
    'Dramatic Arts',
    'Visual Arts',
    'Music',
    'Dance',
    'Consumer Studies',
    'Hospitality Studies',
    'Tourism',
    'Engineering Graphics and Design',
    'Agricultural Sciences',
    // Advanced Programmes
    'Advanced Programme Mathematics',
    'Advanced Programme English',
    'Advanced Programme Physics',
    'Life Sciences Extended Modules',
  ],
  '12': [
    ...IEB_LANGUAGES_SENIOR,
    'Mathematics',
    'Mathematical Literacy',
    'Life Orientation',
    'Life Sciences',
    'Physical Sciences',
    'Earth Sciences',
    'Marine Sciences',
    'Accounting',
    'Business Studies',
    'Economics',
    'Computer Applications Technology',
    'Information Technology',
    'Geography',
    'History',
    'Religion Studies',
    'Social Sciences',
    'Design',
    'Dramatic Arts',
    'Visual Arts',
    'Music',
    'Dance',
    'Consumer Studies',
    'Hospitality Studies',
    'Tourism',
    'Engineering Graphics and Design',
    'Agricultural Sciences',
    // Advanced Programmes
    'Advanced Programme Mathematics',
    'Advanced Programme English',
    'Advanced Programme Physics',
    'Life Sciences Extended Modules',
  ],
};

// Cambridge Subjects
const CAMBRIDGE_IGCSE = [
  // Languages
  'English - First Language',
  'English - Literature',
  'English as a Second Language',
  'Afrikaans - Second Language',
  'French - Foreign Language',
  'German - Foreign Language',
  'Spanish - Foreign Language',
  'Arabic - Foreign Language',
  'Chinese (Mandarin) - Foreign Language',
  'Portuguese - Foreign Language',
  'Latin',
  'Italian - Foreign Language',
  'Japanese - Foreign Language',
  'Greek - Foreign Language',
  'Russian - Foreign Language',
  'Hindi as a Second Language',
  'Urdu as a Second Language',
  'isiZulu as a Second Language',
  // Mathematics
  'Mathematics',
  'Mathematics (Extended)',
  'Additional Mathematics',
  'International Mathematics',
  // Sciences
  'Biology',
  'Chemistry',
  'Physics',
  'Combined Science',
  'Coordinated Science (Double Award)',
  'Environmental Management',
  'Marine Science',
  'Agriculture',
  // Humanities & Social Sciences
  'Geography',
  'History',
  'Sociology',
  'Psychology',
  'Global Perspectives',
  'Economics',
  'Business Studies',
  'Accounting',
  'Development Studies',
  'Enterprise',
  // Technology & Computer
  'Computer Science',
  'Information and Communication Technology (ICT)',
  'Design and Technology',
  'Robotics',
  // Creative & Professional
  'Art and Design',
  'Music',
  'Drama',
  'Media Studies',
  'Travel and Tourism',
  'Food and Nutrition',
  'Physical Education',
];

const CAMBRIDGE_AS_A_LEVEL = [
  // Languages
  'English Language',
  'English Literature',
  'English Language and Literature',
  'Afrikaans',
  'French',
  'German',
  'Spanish',
  'Arabic',
  'Chinese (Mandarin)',
  'Portuguese',
  'Latin',
  'Japanese',
  'Hindi',
  'Urdu',
  // Mathematics
  'Mathematics',
  'Further Mathematics',
  // Sciences
  'Biology',
  'Chemistry',
  'Physics',
  'Environmental Science',
  'Marine Science',
  'Psychology',
  // Humanities & Social Sciences
  'Geography',
  'History',
  'Sociology',
  'Economics',
  'Business',
  'Accounting',
  'Law',
  'Philosophy',
  'Politics',
  'Global Perspectives and Research',
  'Divinity',
  'Classical Studies',
  // Technology & Computer
  'Computer Science',
  'Information Technology',
  'Design and Technology',
  'Digital Media and Design',
  // Creative & Professional
  'Art and Design',
  'Music',
  'Drama',
  'Media Studies',
  'Travel and Tourism',
  'Food and Nutrition',
  'Physical Education',
  'Applied Information Technology',
  'Thinking Skills',
];

const CAMBRIDGE_SUBJECTS: Record<Grade, string[]> = {
  '8': [
    'English',
    'Mathematics',
    'Science',
    'Geography',
    'History',
    'French',
    'German',
    'Spanish',
    'Technology',
    'Art and Design',
    'Music',
    'Drama',
    'Physical Education',
    'Computer Science',
    'Global Perspectives',
  ],
  '9': [
    'English',
    'Mathematics',
    'Science',
    'Geography',
    'History',
    'French',
    'German',
    'Spanish',
    'Technology',
    'Art and Design',
    'Music',
    'Drama',
    'Physical Education',
    'Computer Science',
    'Global Perspectives',
  ],
  '10': CAMBRIDGE_IGCSE,
  '11': CAMBRIDGE_AS_A_LEVEL,
  '12': CAMBRIDGE_AS_A_LEVEL,
};

export const SUBJECTS_BY_CURRICULUM: Record<Curriculum, Record<Grade, string[]>> = {
  caps: CAPS_SUBJECTS,
  ieb: IEB_SUBJECTS,
  cambridge: CAMBRIDGE_SUBJECTS,
};

export function getSubjectsByCurriculumAndGrade(
  curriculum: Curriculum,
  grade: Grade
): string[] {
  return SUBJECTS_BY_CURRICULUM[curriculum]?.[grade] || [];
}

export function getCurriculumEnumValue(curriculum: Curriculum | null): CurriculumEnum {
  if (!curriculum) return 'CAPS';
  const mapping: Record<Curriculum, CurriculumEnum> = {
    'caps': 'CAPS',
    'ieb': 'IEB',
    'cambridge': 'Cambridge',
  };
  return mapping[curriculum] || 'CAPS';
}
