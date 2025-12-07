/**
 * Topics Service
 * Provides random topics for arena comparisons
 * Uses a curated list of universally covered topics that exist in all major encyclopedias
 */

/**
 * Curated list of UNIVERSALLY COVERED topics
 * These are major topics that exist in Wikipedia, Britannica, Grokipedia, etc.
 * Focused on well-known subjects with comprehensive coverage across all sources
 */
export const CURATED_TOPICS = [
  // Major Historical Figures
  'Albert Einstein', 'Isaac Newton', 'Charles Darwin', 'Galileo Galilei',
  'Leonardo da Vinci', 'Nikola Tesla', 'Marie Curie', 'Alexander the Great',
  'Julius Caesar', 'Napoleon Bonaparte', 'Abraham Lincoln', 'George Washington',
  'Winston Churchill', 'Mahatma Gandhi', 'Martin Luther King Jr', 'Nelson Mandela',
  'Cleopatra', 'Queen Victoria', 'William Shakespeare', 'Aristotle',
  'Plato', 'Socrates', 'Confucius', 'Buddha',
  
  // Major Countries
  'United States', 'United Kingdom', 'France', 'Germany',
  'Japan', 'China', 'India', 'Russia',
  'Brazil', 'Australia', 'Canada', 'Italy',
  'Spain', 'Mexico', 'Egypt', 'South Africa',
  
  // Major Cities
  'New York City', 'London', 'Paris', 'Tokyo',
  'Rome', 'Beijing', 'Moscow', 'Berlin',
  'Sydney', 'Los Angeles', 'Chicago', 'San Francisco',
  
  // Core Sciences
  'Physics', 'Chemistry', 'Biology', 'Mathematics',
  'Astronomy', 'Geology', 'Psychology', 'Economics',
  'Computer Science', 'Medicine', 'Engineering', 'Ecology',
  
  // Fundamental Concepts
  'Gravity', 'Electricity', 'Magnetism', 'Light',
  'Sound', 'Heat', 'Energy', 'Matter',
  'Atom', 'Molecule', 'Cell', 'DNA',
  'Evolution', 'Photosynthesis', 'Metabolism', 'Genetics',
  
  // Major Historical Events
  'World War I', 'World War II', 'Cold War', 'American Civil War',
  'French Revolution', 'Industrial Revolution', 'Renaissance', 'Roman Empire',
  'Ancient Egypt', 'Ancient Greece', 'Medieval Europe', 'Age of Exploration',
  
  // Solar System
  'Sun', 'Moon', 'Earth', 'Mars',
  'Jupiter', 'Saturn', 'Venus', 'Mercury',
  'Solar System', 'Milky Way', 'Black Hole', 'Galaxy',
  
  // Major Animals
  'Lion', 'Elephant', 'Tiger', 'Whale',
  'Eagle', 'Shark', 'Bear', 'Wolf',
  'Dog', 'Cat', 'Horse', 'Dolphin',
  'Dinosaur', 'Gorilla', 'Penguin', 'Snake',
  
  // Body Systems & Health
  'Human Heart', 'Human Brain', 'Blood', 'Muscle',
  'Skeleton', 'Lung', 'Liver', 'Kidney',
  'Cancer', 'Diabetes', 'Vaccine', 'Antibiotic',
  
  // Technology
  'Internet', 'Computer', 'Telephone', 'Television',
  'Automobile', 'Airplane', 'Electricity', 'Steam Engine',
  'Nuclear Power', 'Solar Energy', 'Artificial Intelligence', 'Robot',
  
  // Arts & Literature
  'Painting', 'Sculpture', 'Music', 'Literature',
  'Poetry', 'Drama', 'Opera', 'Ballet',
  'Film', 'Photography', 'Architecture', 'Jazz',
  
  // Philosophy & Religion
  'Philosophy', 'Ethics', 'Logic', 'Metaphysics',
  'Christianity', 'Islam', 'Buddhism', 'Hinduism',
  'Judaism', 'Democracy', 'Capitalism', 'Socialism',
  
  // Geography
  'Ocean', 'Mountain', 'River', 'Desert',
  'Forest', 'Island', 'Volcano', 'Earthquake',
  'Pacific Ocean', 'Atlantic Ocean', 'Amazon River', 'Nile River',
  'Mount Everest', 'Sahara Desert', 'Antarctica', 'Arctic',
  
  // Food & Agriculture
  'Agriculture', 'Wheat', 'Rice', 'Corn',
  'Coffee', 'Tea', 'Wine', 'Bread',
  'Water', 'Salt', 'Sugar', 'Milk',
  
  // Sports
  'Football', 'Basketball', 'Baseball', 'Soccer',
  'Tennis', 'Golf', 'Swimming', 'Athletics',
  'Olympic Games', 'Chess', 'Boxing', 'Cricket',
  
  // Major Structures
  'Pyramid', 'Great Wall of China', 'Colosseum', 'Eiffel Tower',
  'Statue of Liberty', 'Taj Mahal', 'Big Ben', 'Golden Gate Bridge',
  
  // Elements & Materials
  'Gold', 'Silver', 'Iron', 'Copper',
  'Carbon', 'Oxygen', 'Hydrogen', 'Nitrogen',
  'Water', 'Air', 'Fire', 'Steel',
  
  // Mathematics
  'Algebra', 'Geometry', 'Calculus', 'Statistics',
  'Number', 'Equation', 'Triangle', 'Circle',
  
  // Language & Communication
  'Language', 'Writing', 'Alphabet', 'Grammar',
  'English Language', 'Spanish Language', 'Chinese Language', 'Arabic Language',
  
  // Law & Government
  'Law', 'Constitution', 'Parliament', 'President',
  'Court', 'Police', 'Army', 'Navy',
  
  // Economics & Business
  'Money', 'Bank', 'Trade', 'Market',
  'Stock', 'Tax', 'Insurance', 'Corporation',
];

/**
 * Get a random topic for arena comparison
 * Uses curated list only (no Wikipedia random API - too many obscure articles)
 */
export async function getRandomTopic(): Promise<string> {
  return CURATED_TOPICS[Math.floor(Math.random() * CURATED_TOPICS.length)];
}

/**
 * Get multiple random topics
 */
export async function getRandomTopics(count: number): Promise<string[]> {
  const shuffled = [...CURATED_TOPICS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get a random curated topic (no API call)
 */
export function getRandomCuratedTopic(): string {
  return CURATED_TOPICS[Math.floor(Math.random() * CURATED_TOPICS.length)];
}

/**
 * Search curated topics
 */
export function searchCuratedTopics(query: string, limit = 10): string[] {
  const lowerQuery = query.toLowerCase();
  return CURATED_TOPICS
    .filter(topic => topic.toLowerCase().includes(lowerQuery))
    .slice(0, limit);
}
