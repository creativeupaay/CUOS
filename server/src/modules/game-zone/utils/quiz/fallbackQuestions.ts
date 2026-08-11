/**
 * Fallback Question Pool
 *
 * These questions are pre-verified and used when AI generation fails
 * or produces insufficient questions.
 *
 * Rules enforced: text-only, objective, defensible, 4 unique options, 1 correct.
 */

export interface FallbackQuestion {
  question: string;
  options: [string, string, string, string];
  correctOption: number;
  explanation: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const FALLBACK_QUESTIONS: FallbackQuestion[] = [
  // ─── ARTIFICIAL INTELLIGENCE ──────────────────────────────────────────────

  {
    question: 'What does LLM stand for in the context of AI?',
    options: ['Large Language Model', 'Long Logic Machine', 'Language Learning Module', 'Large Learning Memory'],
    correctOption: 0,
    explanation: 'LLM stands for Large Language Model, a type of AI trained on massive text datasets.',
    category: 'Artificial Intelligence',
    difficulty: 'easy',
  },
  {
    question: 'Which architecture uses attention mechanisms to model relationships between all tokens in a sequence?',
    options: ['Recurrent Neural Network', 'Convolutional Neural Network', 'Transformer', 'Restricted Boltzmann Machine'],
    correctOption: 2,
    explanation: 'The Transformer architecture (introduced in "Attention is All You Need") uses self-attention mechanisms.',
    category: 'Artificial Intelligence',
    difficulty: 'medium',
  },
  {
    question: 'What is the term for the training phase where an LLM is fine-tuned on human feedback?',
    options: ['Supervised Learning', 'RLHF', 'Transfer Learning', 'Backpropagation'],
    correctOption: 1,
    explanation: 'RLHF (Reinforcement Learning from Human Feedback) aligns LLM outputs with human preferences.',
    category: 'Artificial Intelligence',
    difficulty: 'medium',
  },
  {
    question: 'In machine learning, what is "overfitting"?',
    options: [
      'When the model performs well on training data but poorly on new data',
      'When training takes too long',
      'When the dataset is too large',
      'When the model is too small for the task',
    ],
    correctOption: 0,
    explanation: 'Overfitting occurs when a model memorizes training data instead of learning generalizable patterns.',
    category: 'Artificial Intelligence',
    difficulty: 'easy',
  },
  {
    question: 'Which AI company developed the GPT series of language models?',
    options: ['Google', 'Meta', 'OpenAI', 'Microsoft'],
    correctOption: 2,
    explanation: 'OpenAI developed the GPT (Generative Pre-trained Transformer) series including GPT-3 and GPT-4.',
    category: 'Artificial Intelligence',
    difficulty: 'easy',
  },
  {
    question: 'What does "RAG" stand for in modern AI systems?',
    options: ['Random Access Generation', 'Retrieval-Augmented Generation', 'Recursive Auto Generation', 'Rapid AI Growth'],
    correctOption: 1,
    explanation: 'RAG (Retrieval-Augmented Generation) combines information retrieval with text generation to reduce hallucinations.',
    category: 'Artificial Intelligence',
    difficulty: 'medium',
  },
  {
    question: 'What is a "hallucination" in the context of AI language models?',
    options: [
      'When the AI generates false or fabricated information confidently',
      'When the AI refuses to answer a question',
      'When the AI processes visual data',
      'When the AI runs out of memory',
    ],
    correctOption: 0,
    explanation: 'AI hallucination refers to the model generating plausible-sounding but factually incorrect information.',
    category: 'Artificial Intelligence',
    difficulty: 'easy',
  },
  {
    question: 'Which Google AI model family competes directly with GPT-4?',
    options: ['BERT', 'T5', 'Gemini', 'LaMDA'],
    correctOption: 2,
    explanation: 'Google\'s Gemini family (including Gemini Ultra, Pro, and Flash) is designed to compete with GPT-4.',
    category: 'Artificial Intelligence',
    difficulty: 'easy',
  },
  {
    question: 'What is "prompt engineering"?',
    options: [
      'Building AI hardware',
      'Crafting effective inputs to get desired outputs from AI models',
      'Training AI models from scratch',
      'Compressing AI model size',
    ],
    correctOption: 1,
    explanation: 'Prompt engineering is the practice of designing and optimizing text prompts to elicit the best responses from AI.',
    category: 'Artificial Intelligence',
    difficulty: 'easy',
  },
  {
    question: 'In neural networks, what is a "parameter"?',
    options: [
      'A hyperparameter set before training',
      'A learnable weight or bias updated during training',
      'A fixed mathematical function',
      'The number of training examples',
    ],
    correctOption: 1,
    explanation: 'Parameters (weights and biases) are the learnable values in a neural network, updated during training via backpropagation.',
    category: 'Artificial Intelligence',
    difficulty: 'medium',
  },

  // ─── TECHNOLOGY ──────────────────────────────────────────────────────────

  {
    question: 'What does HTTP stand for?',
    options: ['HyperText Transfer Protocol', 'High Transfer Text Protocol', 'HyperText Transmission Protocol', 'Hyperlink Text Transfer Protocol'],
    correctOption: 0,
    explanation: 'HTTP (HyperText Transfer Protocol) is the foundation of data communication on the World Wide Web.',
    category: 'Technology',
    difficulty: 'easy',
  },
  {
    question: 'What is the primary purpose of a CDN (Content Delivery Network)?',
    options: [
      'To store user passwords securely',
      'To deliver content faster by serving it from servers closer to users',
      'To encrypt all web traffic',
      'To manage database connections',
    ],
    correctOption: 1,
    explanation: 'CDNs distribute copies of content across multiple geographically distributed servers to reduce latency.',
    category: 'Technology',
    difficulty: 'medium',
  },
  {
    question: 'What does API stand for?',
    options: ['Application Programming Interface', 'Automated Program Interaction', 'Application Process Integration', 'Applied Programming Instructions'],
    correctOption: 0,
    explanation: 'API (Application Programming Interface) defines how software components interact with each other.',
    category: 'Technology',
    difficulty: 'easy',
  },
  {
    question: 'Which protocol is typically used for secure data transmission over the internet?',
    options: ['HTTP', 'FTP', 'HTTPS', 'SMTP'],
    correctOption: 2,
    explanation: 'HTTPS (HTTP Secure) uses TLS/SSL encryption to secure data transmitted between browsers and servers.',
    category: 'Technology',
    difficulty: 'easy',
  },
  {
    question: 'What is the purpose of a firewall in network security?',
    options: [
      'To speed up internet connections',
      'To monitor and control incoming and outgoing network traffic',
      'To store backup data',
      'To compress network packets',
    ],
    correctOption: 1,
    explanation: 'A firewall monitors and controls network traffic based on predetermined security rules.',
    category: 'Technology',
    difficulty: 'easy',
  },
  {
    question: 'What is "cloud computing"?',
    options: [
      'Computing that only works in bad weather',
      'Delivering computing services over the internet on demand',
      'A type of offline storage',
      'Networking between nearby devices only',
    ],
    correctOption: 1,
    explanation: 'Cloud computing delivers computing services (servers, storage, databases, networking, software) over the internet.',
    category: 'Technology',
    difficulty: 'easy',
  },
  {
    question: 'What does DNS stand for, and what does it do?',
    options: [
      'Data Network System — manages network speed',
      'Domain Name System — translates domain names to IP addresses',
      'Digital Node Service — connects cloud services',
      'Domain Navigation Software — controls routing',
    ],
    correctOption: 1,
    explanation: 'DNS (Domain Name System) translates human-readable domain names (e.g., google.com) into IP addresses.',
    category: 'Technology',
    difficulty: 'medium',
  },
  {
    question: 'Which company created the Android mobile operating system?',
    options: ['Apple', 'Samsung', 'Google', 'Microsoft'],
    correctOption: 2,
    explanation: 'Android was created by Android Inc., which was acquired by Google in 2005.',
    category: 'Technology',
    difficulty: 'easy',
  },

  // ─── PROGRAMMING ─────────────────────────────────────────────────────────

  {
    question: 'What is the time complexity of binary search?',
    options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'],
    correctOption: 2,
    explanation: 'Binary search has O(log n) time complexity because it halves the search space on each step.',
    category: 'Programming',
    difficulty: 'medium',
  },
  {
    question: 'What does SOLID stand for in software design?',
    options: [
      'Single, Open, Liskov, Interface, Dependency principles',
      'Structured, Ordered, Linked, Independent, Documented',
      'Scalable, Optimized, Loose-coupled, Integrated, Deployed',
      'Synchronized, Object-based, Layered, Isolated, Decoupled',
    ],
    correctOption: 0,
    explanation: 'SOLID is an acronym for five OOP design principles: Single responsibility, Open-closed, Liskov substitution, Interface segregation, Dependency inversion.',
    category: 'Programming',
    difficulty: 'hard',
  },
  {
    question: 'What is a "race condition" in programming?',
    options: [
      'A performance optimization technique',
      'A bug where program behavior depends on non-deterministic timing of events',
      'A type of loop that runs as fast as possible',
      'A design pattern for parallel computation',
    ],
    correctOption: 1,
    explanation: 'A race condition occurs when two or more threads access shared data simultaneously and the outcome depends on their execution order.',
    category: 'Programming',
    difficulty: 'hard',
  },
  {
    question: 'What is the purpose of version control systems like Git?',
    options: [
      'To speed up code compilation',
      'To track changes in code over time and enable collaboration',
      'To convert code between programming languages',
      'To run tests automatically',
    ],
    correctOption: 1,
    explanation: 'Version control systems track changes in code, allow collaboration, and enable reverting to previous versions.',
    category: 'Programming',
    difficulty: 'easy',
  },
  {
    question: 'What is "recursion" in programming?',
    options: [
      'A loop that runs forever',
      'A function that calls itself to solve a problem',
      'A data structure for storing items',
      'A method for parallel processing',
    ],
    correctOption: 1,
    explanation: 'Recursion is when a function calls itself with a simpler version of the problem until a base case is reached.',
    category: 'Programming',
    difficulty: 'easy',
  },
  {
    question: 'Which data structure operates on a Last-In-First-Out (LIFO) basis?',
    options: ['Queue', 'Stack', 'Linked List', 'Hash Map'],
    correctOption: 1,
    explanation: 'A Stack uses LIFO order — the last element pushed is the first one popped, like a stack of plates.',
    category: 'Programming',
    difficulty: 'easy',
  },
  {
    question: 'What is the primary advantage of using indexes in a database?',
    options: [
      'To increase storage capacity',
      'To speed up data retrieval queries',
      'To enforce data types',
      'To compress data',
    ],
    correctOption: 1,
    explanation: 'Database indexes speed up SELECT queries by creating a separate data structure that allows quick lookups.',
    category: 'Programming',
    difficulty: 'medium',
  },

  // ─── JAVASCRIPT ──────────────────────────────────────────────────────────

  {
    question: 'What is the output of: typeof null in JavaScript?',
    options: ['"null"', '"undefined"', '"object"', '"number"'],
    correctOption: 2,
    explanation: 'typeof null returns "object" in JavaScript — this is a historical bug that was never fixed for backward compatibility.',
    category: 'JavaScript',
    difficulty: 'medium',
  },
  {
    question: 'What does the "==" operator do in JavaScript compared to "==="?',
    options: [
      '"==" performs strict equality, "===" performs loose equality',
      '"==" performs type coercion before comparing, "===" requires same type and value',
      'They are identical in behavior',
      '"===" is only for strings',
    ],
    correctOption: 1,
    explanation: '"==" performs type coercion (1 == "1" is true), while "===" requires both type and value to match (1 === "1" is false).',
    category: 'JavaScript',
    difficulty: 'medium',
  },
  {
    question: 'What is a Promise in JavaScript?',
    options: [
      'A guarantee that code will never fail',
      'An object representing the eventual completion or failure of an async operation',
      'A type of loop for async code',
      'A way to synchronize multiple threads',
    ],
    correctOption: 1,
    explanation: 'A Promise represents an asynchronous operation that will eventually resolve (succeed) or reject (fail).',
    category: 'JavaScript',
    difficulty: 'medium',
  },
  {
    question: 'What does "hoisting" mean in JavaScript?',
    options: [
      'Moving code to a server',
      'JavaScript moving declarations to the top of their scope before execution',
      'A method to increase performance',
      'Converting a function to an arrow function',
    ],
    correctOption: 1,
    explanation: 'Hoisting moves variable and function declarations to the top of their scope during the compilation phase.',
    category: 'JavaScript',
    difficulty: 'medium',
  },
  {
    question: 'Which method is used to add an element to the end of a JavaScript array?',
    options: ['unshift()', 'push()', 'concat()', 'append()'],
    correctOption: 1,
    explanation: 'Array.push() adds one or more elements to the end of an array and returns the new length.',
    category: 'JavaScript',
    difficulty: 'easy',
  },
  {
    question: 'What is the purpose of "async/await" in JavaScript?',
    options: [
      'To run multiple functions simultaneously',
      'To write asynchronous code in a more synchronous-looking style',
      'To create new threads in JavaScript',
      'To prevent all async operations',
    ],
    correctOption: 1,
    explanation: 'async/await provides a cleaner syntax for working with Promises, making async code look and behave more like synchronous code.',
    category: 'JavaScript',
    difficulty: 'medium',
  },

  // ─── SCIENCE ─────────────────────────────────────────────────────────────

  {
    question: 'What is the speed of light in a vacuum?',
    options: ['300,000 km/s', '150,000 km/s', '450,000 km/s', '1,000,000 km/s'],
    correctOption: 0,
    explanation: 'Light travels at approximately 299,792 km/s (≈300,000 km/s) in a vacuum.',
    category: 'Science',
    difficulty: 'easy',
  },
  {
    question: 'What is the chemical symbol for gold?',
    options: ['Gd', 'Go', 'Au', 'Ag'],
    correctOption: 2,
    explanation: 'Gold\'s chemical symbol is Au, from the Latin word "Aurum".',
    category: 'Science',
    difficulty: 'easy',
  },
  {
    question: 'What force keeps planets in orbit around the Sun?',
    options: ['Electromagnetic force', 'Nuclear force', 'Gravitational force', 'Centrifugal force'],
    correctOption: 2,
    explanation: 'Gravity — specifically the Sun\'s massive gravitational force — keeps planets in their orbits.',
    category: 'Science',
    difficulty: 'easy',
  },
  {
    question: 'What is the unit of electric current?',
    options: ['Volt', 'Watt', 'Ohm', 'Ampere'],
    correctOption: 3,
    explanation: 'The Ampere (A) is the SI unit of electric current, measuring the rate of flow of electric charge.',
    category: 'Science',
    difficulty: 'easy',
  },
  {
    question: 'What is the most abundant gas in Earth\'s atmosphere?',
    options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'],
    correctOption: 2,
    explanation: 'Nitrogen (N₂) makes up approximately 78% of Earth\'s atmosphere, followed by oxygen at 21%.',
    category: 'Science',
    difficulty: 'easy',
  },
  {
    question: 'What is Newton\'s Second Law of Motion?',
    options: [
      'Every action has an equal and opposite reaction',
      'An object in motion stays in motion unless acted upon by force',
      'Force equals mass times acceleration (F = ma)',
      'Energy cannot be created or destroyed',
    ],
    correctOption: 2,
    explanation: 'Newton\'s Second Law states that Force = Mass × Acceleration (F = ma).',
    category: 'Science',
    difficulty: 'medium',
  },
  {
    question: 'What is the process by which plants make their own food using sunlight?',
    options: ['Respiration', 'Photosynthesis', 'Fermentation', 'Transpiration'],
    correctOption: 1,
    explanation: 'Photosynthesis converts CO₂ and water into glucose using light energy from the sun.',
    category: 'Science',
    difficulty: 'easy',
  },

  // ─── HISTORY ─────────────────────────────────────────────────────────────

  {
    question: 'When did India gain independence from British rule?',
    options: ['1945', '1947', '1950', '1942'],
    correctOption: 1,
    explanation: 'India gained independence from British rule on 15 August 1947.',
    category: 'History',
    difficulty: 'easy',
  },
  {
    question: 'Who was the first Prime Minister of independent India?',
    options: ['Mahatma Gandhi', 'Sardar Patel', 'Jawaharlal Nehru', 'B.R. Ambedkar'],
    correctOption: 2,
    explanation: 'Jawaharlal Nehru served as India\'s first Prime Minister from 1947 to 1964.',
    category: 'History',
    difficulty: 'easy',
  },
  {
    question: 'In which year did World War II end?',
    options: ['1943', '1944', '1945', '1946'],
    correctOption: 2,
    explanation: 'World War II ended in 1945 — in Europe on 8 May (VE Day) and in the Pacific on 2 September (VJ Day).',
    category: 'History',
    difficulty: 'easy',
  },
  {
    question: 'Who wrote the Indian National Anthem "Jana Gana Mana"?',
    options: ['Bankim Chandra Chatterjee', 'Rabindranath Tagore', 'Sarojini Naidu', 'Subramanya Bharati'],
    correctOption: 1,
    explanation: 'Rabindranath Tagore wrote "Jana Gana Mana", which was adopted as India\'s national anthem in 1950.',
    category: 'History',
    difficulty: 'easy',
  },
  {
    question: 'Which civilization built the Machu Picchu complex in Peru?',
    options: ['Aztec', 'Maya', 'Inca', 'Olmec'],
    correctOption: 2,
    explanation: 'Machu Picchu was built by the Inca civilization around 1450 CE and was later abandoned during the Spanish conquest.',
    category: 'History',
    difficulty: 'medium',
  },

  // ─── GEOGRAPHY ───────────────────────────────────────────────────────────

  {
    question: 'What is the capital city of Australia?',
    options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
    correctOption: 2,
    explanation: 'Canberra is the capital of Australia, chosen as a compromise between Sydney and Melbourne in 1908.',
    category: 'Geography',
    difficulty: 'medium',
  },
  {
    question: 'Which is the largest ocean in the world?',
    options: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean'],
    correctOption: 3,
    explanation: 'The Pacific Ocean is the largest and deepest ocean, covering more than 30% of Earth\'s surface.',
    category: 'Geography',
    difficulty: 'easy',
  },
  {
    question: 'Which river is the longest in the world?',
    options: ['Amazon', 'Yangtze', 'Nile', 'Mississippi'],
    correctOption: 2,
    explanation: 'The Nile River in Africa is generally considered the longest river in the world at approximately 6,650 km.',
    category: 'Geography',
    difficulty: 'easy',
  },
  {
    question: 'How many countries are in the African continent?',
    options: ['44', '54', '48', '62'],
    correctOption: 1,
    explanation: 'Africa has 54 recognized sovereign countries, making it the continent with the most countries.',
    category: 'Geography',
    difficulty: 'medium',
  },
  {
    question: 'Which country has the most time zones?',
    options: ['USA', 'Russia', 'France', 'China'],
    correctOption: 2,
    explanation: 'France has 12 time zones when including its overseas territories, more than any other country.',
    category: 'Geography',
    difficulty: 'hard',
  },

  // ─── CRICKET ─────────────────────────────────────────────────────────────

  {
    question: 'How many players are there in a cricket team?',
    options: ['9', '10', '11', '12'],
    correctOption: 2,
    explanation: 'A cricket team has 11 players.',
    category: 'Cricket',
    difficulty: 'easy',
  },
  {
    question: 'What is the maximum number of overs in a standard ODI cricket match for each team?',
    options: ['20', '40', '50', '60'],
    correctOption: 2,
    explanation: 'In ODI (One Day International) cricket, each team plays a maximum of 50 overs.',
    category: 'Cricket',
    difficulty: 'easy',
  },
  {
    question: 'Who holds the record for the most international centuries in cricket?',
    options: ['Ricky Ponting', 'Virat Kohli', 'Sachin Tendulkar', 'Brian Lara'],
    correctOption: 2,
    explanation: 'Sachin Tendulkar holds the record with 100 international centuries (51 Tests + 49 ODIs).',
    category: 'Cricket',
    difficulty: 'easy',
  },
  {
    question: 'In cricket, what is a "duck"?',
    options: ['A score of 1 run', 'A dismissal for 0 runs', 'A type of delivery', 'A fielding position'],
    correctOption: 1,
    explanation: 'A duck in cricket is when a batsman is dismissed without scoring any runs (score of 0).',
    category: 'Cricket',
    difficulty: 'easy',
  },
  {
    question: 'How many balls are in a standard cricket over?',
    options: ['4', '5', '6', '8'],
    correctOption: 2,
    explanation: 'A standard cricket over consists of 6 balls bowled by the same bowler.',
    category: 'Cricket',
    difficulty: 'easy',
  },
  {
    question: 'Which country has won the most Cricket World Cup titles?',
    options: ['India', 'Australia', 'West Indies', 'Pakistan'],
    correctOption: 1,
    explanation: 'Australia has won the Cricket World Cup 6 times (1987, 1999, 2003, 2007, 2015, 2023).',
    category: 'Cricket',
    difficulty: 'medium',
  },

  // ─── FOOTBALL ────────────────────────────────────────────────────────────

  {
    question: 'How long is a standard football (soccer) match?',
    options: ['80 minutes', '90 minutes', '100 minutes', '120 minutes'],
    correctOption: 1,
    explanation: 'A standard football match consists of two 45-minute halves, totaling 90 minutes of regulation play.',
    category: 'Football',
    difficulty: 'easy',
  },
  {
    question: 'Which country has won the most FIFA World Cup titles?',
    options: ['Germany', 'Argentina', 'Brazil', 'France'],
    correctOption: 2,
    explanation: 'Brazil has won the FIFA World Cup 5 times (1958, 1962, 1970, 1994, 2002).',
    category: 'Football',
    difficulty: 'easy',
  },
  {
    question: 'Who has won the most Ballon d\'Or awards in football history?',
    options: ['Cristiano Ronaldo', 'Lionel Messi', 'Ronaldo Nazário', 'Zinedine Zidane'],
    correctOption: 1,
    explanation: 'Lionel Messi has won the most Ballon d\'Or awards with 8 titles (through 2023).',
    category: 'Football',
    difficulty: 'medium',
  },
  {
    question: 'What shape is a standard football?',
    options: ['Sphere', 'Prolate spheroid', 'Oblate spheroid', 'Truncated icosahedron'],
    correctOption: 3,
    explanation: 'A football is a truncated icosahedron — composed of 20 regular hexagonal and 12 regular pentagonal patches.',
    category: 'Football',
    difficulty: 'hard',
  },

  // ─── BUSINESS ────────────────────────────────────────────────────────────

  {
    question: 'What does ROI stand for in business?',
    options: ['Rate of Income', 'Return on Investment', 'Revenue Over Income', 'Risk of Investment'],
    correctOption: 1,
    explanation: 'ROI (Return on Investment) measures the profitability of an investment relative to its cost.',
    category: 'Business',
    difficulty: 'easy',
  },
  {
    question: 'What is a "startup"?',
    options: [
      'Any small business',
      'A company designed to scale rapidly and solve a significant market problem',
      'A government-funded business',
      'A business open for less than one year',
    ],
    correctOption: 1,
    explanation: 'A startup is a newly established business designed to grow rapidly, typically using technology to scale.',
    category: 'Business',
    difficulty: 'easy',
  },
  {
    question: 'What does B2B stand for in business?',
    options: ['Business to Budget', 'Business to Business', 'Buyer to Business', 'Business to Brand'],
    correctOption: 1,
    explanation: 'B2B (Business-to-Business) refers to transactions between businesses rather than between a business and consumers.',
    category: 'Business',
    difficulty: 'easy',
  },
  {
    question: 'What is venture capital?',
    options: [
      'A type of bank loan for businesses',
      'Investment provided to early-stage companies with high growth potential in exchange for equity',
      'A government grant for small businesses',
      'Revenue generated from business ventures',
    ],
    correctOption: 1,
    explanation: 'Venture capital is private equity financing provided to startups and early-stage companies with high growth potential.',
    category: 'Business',
    difficulty: 'medium',
  },

  // ─── INDIA ───────────────────────────────────────────────────────────────

  {
    question: 'What is the national animal of India?',
    options: ['Lion', 'Elephant', 'Bengal Tiger', 'Indian Peacock'],
    correctOption: 2,
    explanation: 'The Bengal Tiger (Panthera tigris tigris) is the national animal of India.',
    category: 'India',
    difficulty: 'easy',
  },
  {
    question: 'In which city is the Taj Mahal located?',
    options: ['Delhi', 'Jaipur', 'Agra', 'Lucknow'],
    correctOption: 2,
    explanation: 'The Taj Mahal is located in Agra, Uttar Pradesh, India, on the banks of the Yamuna river.',
    category: 'India',
    difficulty: 'easy',
  },
  {
    question: 'How many states are in India (as of 2024)?',
    options: ['25', '28', '30', '32'],
    correctOption: 1,
    explanation: 'India has 28 states and 8 Union Territories as of 2024.',
    category: 'India',
    difficulty: 'medium',
  },
  {
    question: 'Which is the largest state in India by area?',
    options: ['Maharashtra', 'Uttar Pradesh', 'Rajasthan', 'Madhya Pradesh'],
    correctOption: 2,
    explanation: 'Rajasthan is the largest state in India by area, covering approximately 342,239 km².',
    category: 'India',
    difficulty: 'medium',
  },
  {
    question: 'What is the currency of India?',
    options: ['Taka', 'Rupiah', 'Rupee', 'Dinar'],
    correctOption: 2,
    explanation: 'The Indian Rupee (₹, ISO code: INR) is the official currency of India.',
    category: 'India',
    difficulty: 'easy',
  },

  // ─── GENERAL KNOWLEDGE ───────────────────────────────────────────────────

  {
    question: 'How many continents are there on Earth?',
    options: ['5', '6', '7', '8'],
    correctOption: 2,
    explanation: 'Earth has 7 continents: Africa, Antarctica, Asia, Europe, North America, Oceania/Australia, and South America.',
    category: 'General Knowledge',
    difficulty: 'easy',
  },
  {
    question: 'What is the smallest planet in our solar system?',
    options: ['Mars', 'Mercury', 'Venus', 'Pluto'],
    correctOption: 1,
    explanation: 'Mercury is the smallest planet in our solar system (Pluto was reclassified as a dwarf planet in 2006).',
    category: 'General Knowledge',
    difficulty: 'easy',
  },
  {
    question: 'In what year was the first iPhone released?',
    options: ['2005', '2006', '2007', '2008'],
    correctOption: 2,
    explanation: 'Steve Jobs unveiled the first iPhone on January 9, 2007, and it went on sale on June 29, 2007.',
    category: 'General Knowledge',
    difficulty: 'easy',
  },
  {
    question: 'What is the hardest natural substance on Earth?',
    options: ['Gold', 'Iron', 'Diamond', 'Quartz'],
    correctOption: 2,
    explanation: 'Diamond is the hardest natural material, scoring 10 on the Mohs hardness scale.',
    category: 'General Knowledge',
    difficulty: 'easy',
  },
  {
    question: 'How many bones are in the adult human body?',
    options: ['186', '196', '206', '216'],
    correctOption: 2,
    explanation: 'An adult human body has 206 bones. Babies are born with about 270 bones that fuse over time.',
    category: 'General Knowledge',
    difficulty: 'medium',
  },
  {
    question: 'Which planet is known as the "Red Planet"?',
    options: ['Jupiter', 'Venus', 'Mars', 'Saturn'],
    correctOption: 2,
    explanation: 'Mars appears red because its surface is covered in iron oxide (rust), giving it a distinctive reddish color.',
    category: 'General Knowledge',
    difficulty: 'easy',
  },
  {
    question: 'What is the square root of 144?',
    options: ['11', '12', '13', '14'],
    correctOption: 1,
    explanation: '√144 = 12, because 12 × 12 = 144.',
    category: 'General Knowledge',
    difficulty: 'easy',
  },
  {
    question: 'Who painted the Mona Lisa?',
    options: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Sandro Botticelli'],
    correctOption: 2,
    explanation: 'Leonardo da Vinci painted the Mona Lisa between approximately 1503 and 1519.',
    category: 'General Knowledge',
    difficulty: 'easy',
  },
];

/**
 * Category keywords for topic-to-category matching.
 * Used by the fallback provider to find relevant questions.
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Artificial Intelligence': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'neural', 'llm', 'gpt', 'deep learning', 'chatgpt', 'gemini', 'nlp'],
  'Technology': ['technology', 'tech', 'computer', 'internet', 'software', 'hardware', 'network', 'cybersecurity', 'cloud', 'data'],
  'Programming': ['programming', 'coding', 'algorithm', 'data structure', 'software engineering', 'development', 'backend', 'frontend'],
  'JavaScript': ['javascript', 'js', 'typescript', 'react', 'node', 'vue', 'angular', 'web development'],
  'Science': ['science', 'physics', 'chemistry', 'biology', 'astronomy', 'space', 'nature', 'environment'],
  'History': ['history', 'historical', 'ancient', 'civilization', 'war', 'empire', 'revolution'],
  'Geography': ['geography', 'country', 'capital', 'continent', 'ocean', 'mountain', 'river', 'map'],
  'Cricket': ['cricket', 'ipl', 'test cricket', 'odi', 't20', 'batsman', 'bowler'],
  'Football': ['football', 'soccer', 'fifa', 'premier league', 'champions league', 'world cup football'],
  'Business': ['business', 'finance', 'entrepreneurship', 'startup', 'economics', 'marketing', 'management'],
  'India': ['india', 'indian', 'bharatiya', 'hindi', 'bollywood', 'delhi', 'mumbai', 'culture of india'],
  'General Knowledge': ['general knowledge', 'gk', 'trivia', 'quiz'],
};
