import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const projects = [
  {
    title: "Community Tech Mentorship",
    description: "Empower older adults or younger students by developing digital literacy and computer skills, bridging the digital divide.",
    category: "STEM / Community Service",
    minGrade: 8,
    maxGrade: 12,
    difficulty: "Beginner",
    requiredSkills: JSON.stringify(["communication", "teaching", "basic computer skills"]),
    tags: JSON.stringify(["education", "technology", "community service", "mentorship"]),
    suggestedExecutionPathways: JSON.stringify([
      "Organize local workshops at community centers for elderly users",
      "Create an online tutoring/mentorship platform for younger kids",
      "Partner with a local school to run an after-school coding club"
    ])
  },
  {
    title: "Local Recycling Campaign & Waste Audit",
    description: "Audit plastic/paper usage and waste in your local school or neighborhood, and run campaigns to increase sustainable recycling rates.",
    category: "Environment / STEM",
    minGrade: 8,
    maxGrade: 10,
    difficulty: "Beginner",
    requiredSkills: JSON.stringify(["organization", "public speaking", "data collection"]),
    tags: JSON.stringify(["sustainability", "environment", "data analysis", "activism"]),
    suggestedExecutionPathways: JSON.stringify([
      "Conduct waste audits at school and implement a composting program",
      "Build a local neighborhood recycling awareness app or website",
      "Host community cleanups and write a report for the town council"
    ])
  },
  {
    title: "Youth Business Incubator & Micro-Enterprise",
    description: "Conceptualize, develop, and launch a micro-enterprise or non-profit to solve a specific business or community problem.",
    category: "Business / Entrepreneurship",
    minGrade: 10,
    maxGrade: 12,
    difficulty: "Advanced",
    requiredSkills: JSON.stringify(["marketing", "finance", "planning", "creativity"]),
    tags: JSON.stringify(["entrepreneurship", "business", "leadership", "finance"]),
    suggestedExecutionPathways: JSON.stringify([
      "Launch a small online shop selling sustainable handmade products",
      "Create a business proposal/business plan and pitch it to local mentors",
      "Develop a non-profit service to solve a specific local community problem"
    ])
  },
  {
    title: "Historical Preservation & Storytelling Podcast",
    description: "Capture, preserve, and share oral histories from senior citizens or local historical figures through digital media.",
    category: "Humanities / Arts",
    minGrade: 9,
    maxGrade: 12,
    difficulty: "Intermediate",
    requiredSkills: JSON.stringify(["writing", "interviewing", "audio editing", "history"]),
    tags: JSON.stringify(["podcast", "storytelling", "history", "media"]),
    suggestedExecutionPathways: JSON.stringify([
      "Record a 5-episode podcast interviewing local war veterans or elders",
      "Write and publish an illustrated local history booklet or blog",
      "Curate a virtual museum exhibit using photos and archival documents"
    ])
  },
  {
    title: "Machine Learning for Climate Data Analysis",
    description: "Analyze public temperature or deforestation datasets using Python to model and predict regional climate change trends.",
    category: "STEM / Advanced Data Science",
    minGrade: 11,
    maxGrade: 12,
    difficulty: "Advanced",
    requiredSkills: JSON.stringify(["python", "data analysis", "statistics", "machine learning"]),
    tags: JSON.stringify(["AI", "machine learning", "python", "climate change", "data science"]),
    suggestedExecutionPathways: JSON.stringify([
      "Analyze public temperature anomalies using Python and predict future trends",
      "Build a classifier that identifies deforestation patterns from satellite images",
      "Develop an interactive web dashboard visualizing regional air quality indices"
    ])
  },
  {
    title: "Mental Health Awareness Campaign",
    description: "Build resources and campaigns to reduce the stigma surrounding mental health issues among high school teens.",
    category: "Humanities / Social Science",
    minGrade: 8,
    maxGrade: 12,
    difficulty: "Intermediate",
    requiredSkills: JSON.stringify(["writing", "graphic design", "empathy", "communication"]),
    tags: JSON.stringify(["mental health", "advocacy", "design", "wellness"]),
    suggestedExecutionPathways: JSON.stringify([
      "Design and launch an Instagram advocacy page with science-backed infographics",
      "Organize a wellness week at your high school with speaker sessions",
      "Produce a short documentary film detailing student stress and coping mechanisms"
    ])
  },
  {
    title: "Accessibility Audits for Public Spaces",
    description: "Review physical and digital public spaces to audit their accessibility for people with disabilities, and present improvements to officials.",
    category: "Engineering / Social Impact",
    minGrade: 9,
    maxGrade: 12,
    difficulty: "Intermediate",
    requiredSkills: JSON.stringify(["research", "technical writing", "empathy", "photography"]),
    tags: JSON.stringify(["accessibility", "community impact", "civil engineering", "inclusion"]),
    suggestedExecutionPathways: JSON.stringify([
      "Audit school buildings for wheelchair accessibility and present findings to the principal",
      "Map out accessible transit routes in your city and publish an online guide",
      "Organize a community workshop raising awareness about digital web accessibility"
    ])
  },
  {
    title: "App Development for Student Organization",
    description: "Design and program a web or mobile application that helps students coordinate study sessions, monitor tasks, or find extracurricular clubs.",
    category: "STEM / Programming",
    minGrade: 9,
    maxGrade: 12,
    difficulty: "Advanced",
    requiredSkills: JSON.stringify(["coding", "UI/UX design", "problem solving", "product management"]),
    tags: JSON.stringify(["app development", "coding", "productivity", "education"]),
    suggestedExecutionPathways: JSON.stringify([
      "Build a web/mobile app to help students coordinate study groups and tutoring",
      "Develop an extracurricular club directory and event organizer for your school",
      "Program a personal habits tracker that gamifies student task completion"
    ])
  },
  {
    title: "Creative Writing & Youth Anthology",
    description: "Write, compile, edit, and publish a collection of creative stories and poetry highlighting youth perspectives on global issues.",
    category: "Arts / Literature",
    minGrade: 8,
    maxGrade: 11,
    difficulty: "Beginner",
    requiredSkills: JSON.stringify(["writing", "editing", "graphic design", "collaboration"]),
    tags: JSON.stringify(["creative writing", "poetry", "publishing", "art"]),
    suggestedExecutionPathways: JSON.stringify([
      "Gather submissions from peers and publish a printed literary magazine",
      "Write and self-publish a personal novel or collection of short stories",
      "Launch a blog publishing weekly essays on youth perspectives on global issues"
    ])
  },
  {
    title: "Urban Rooftop & Community Garden",
    description: "Research and implement a green growth system at school or home, learning botanical biology and environmental engineering.",
    category: "Environment / STEM",
    minGrade: 8,
    maxGrade: 12,
    difficulty: "Intermediate",
    requiredSkills: JSON.stringify(["biology", "manual labor", "organization", "fundraising"]),
    tags: JSON.stringify(["agriculture", "sustainability", "biology", "community"]),
    suggestedExecutionPathways: JSON.stringify([
      "Construct a vertical herb garden at school using recycled plastic bottles",
      "Partner with a local food bank to grow fresh vegetables in a community plot",
      "Design a rainwater harvesting system blueprint for urban school gardens"
    ])
  },
  {
    title: "Financial Literacy for Teens",
    description: "Create educational resources to teach high school students about budgeting, savings, investing, and student loans.",
    category: "Business / Education",
    minGrade: 9,
    maxGrade: 12,
    difficulty: "Beginner",
    requiredSkills: JSON.stringify(["research", "public speaking", "content creation", "basic finance"]),
    tags: JSON.stringify(["finance", "education", "mentorship", "presentation"]),
    suggestedExecutionPathways: JSON.stringify([
      "Create a series of TikTok/YouTube shorts teaching budgeting and savings to teens",
      "Develop and run a 3-part financial literacy workshop at your local library",
      "Write an interactive e-book on investing basics tailored to high schoolers"
    ])
  },
  {
    title: "Public Health Survey and Infographics",
    description: "Survey peers to collect healthcare data (sleep, nutrition, screen-time) and design infographics to drive behavioral improvements.",
    category: "STEM / Social Science",
    minGrade: 10,
    maxGrade: 12,
    difficulty: "Intermediate",
    requiredSkills: JSON.stringify(["data analysis", "design", "statistics", "health sciences"]),
    tags: JSON.stringify(["public health", "data analysis", "design", "research"]),
    suggestedExecutionPathways: JSON.stringify([
      "Survey 100 students on sleep habits and create an infographic campaign on sleep health",
      "Analyze correlation between physical activity and stress levels in high schoolers",
      "Create a healthy meal prep brochure and distribute it to local community centers"
    ])
  },
  {
    title: "DIY Robotics & IoT Home Automation",
    description: "Design and assemble micro-controller systems (Arduino/Raspberry Pi) that automate tasks in the household or classroom.",
    category: "STEM / Engineering",
    minGrade: 10,
    maxGrade: 12,
    difficulty: "Advanced",
    requiredSkills: JSON.stringify(["electronics", "coding", "problem solving", "hardware"]),
    tags: JSON.stringify(["robotics", "IoT", "engineering", "coding"]),
    suggestedExecutionPathways: JSON.stringify([
      "Build an automated plant watering system using Arduino and moisture sensors",
      "Design a smart energy monitoring plug that tracks appliance power consumption",
      "Program a voice-controlled room lighting setup using Raspberry Pi"
    ])
  },
  {
    title: "Art Therapy Workshops",
    description: "Run visual art sessions for local senior citizens or distressed youths to support fine motor skills and alleviate stress.",
    category: "Arts / Psychology",
    minGrade: 8,
    maxGrade: 12,
    difficulty: "Intermediate",
    requiredSkills: JSON.stringify(["art", "facilitation", "empathy", "organization"]),
    tags: JSON.stringify(["art", "psychology", "community service", "wellness"]),
    suggestedExecutionPathways: JSON.stringify([
      "Run art sessions at a local retirement home to improve fine motor skills and mood",
      "Create a school mural focused on inclusivity and collective student expression",
      "Host weekend watercolor classes for children at a local library to reduce anxiety"
    ])
  },
  {
    title: "Mock Trial & Speech Club Founder",
    description: "Establish a public speaking and formal debate framework at a local school to build advocacy and reasoning skills.",
    category: "Humanities / Law",
    minGrade: 9,
    maxGrade: 12,
    difficulty: "Intermediate",
    requiredSkills: JSON.stringify(["public speaking", "research", "debating", "leadership"]),
    tags: JSON.stringify(["law", "debate", "leadership", "education"]),
    suggestedExecutionPathways: JSON.stringify([
      "Establish a new Speech and Debate club at your school and train members",
      "Organize a district-wide mock trial event simulating a historic legal case",
      "Run public speaking workshops for middle school students to build confidence"
    ])
  }
];

async function main() {
  console.log("Seeding databases...");
  
  // Clean existing ProjectDB entries
  await prisma.projectDB.deleteMany();
  
  for (const p of projects) {
    await prisma.projectDB.create({
      data: p
    });
  }
  
  console.log(`Seeded ${projects.length} curated projects successfully.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
