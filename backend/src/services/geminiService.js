import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Helper to instantiate Gemini client dynamically
export const getAiClient = (customKey) => {
  const activeKey = customKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!activeKey) return null;
  return new GoogleGenAI({ apiKey: activeKey });
};

// Helper to check if API key is configured (either server or custom)
export const isAiConfigured = (customKey) => {
  return !!(customKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
};

/**
 * Filter and rank database projects based on student profile.
 */
export const rankProjects = async (profile, projects, customKey) => {
  const client = getAiClient(customKey);
  if (!client) {
    console.warn("Gemini API key not configured. Falling back to deterministic filtering.");
    return fallbackRanking(profile, projects);
  }

  try {
    const prompt = `
      You are an expert high school academic advisor.
      Analyze the student's profile and rank the top 1-3 projects from the curated database that fit them best.
      
      Student Profile:
      - Grade: ${profile.grade}
      - Academic Subjects: ${JSON.stringify(profile.academicSubjects)}
      - Interests & Hobbies: ${JSON.stringify(profile.interests)}
      - Career Goals: ${JSON.stringify(profile.careerGoals)}
      - Extracurriculars: ${JSON.stringify(profile.extracurriculars)}
      - Skills: ${JSON.stringify(profile.skills)}
      - Target Universities: ${JSON.stringify(profile.targetUniversities)}
      
      Available Curated Projects:
      ${projects.map(p => `
        - ID: ${p.id}
          Title: ${p.title}
          Description: ${p.description}
          Category: ${p.category}
          Grades: ${p.minGrade} to ${p.maxGrade}
          Difficulty: ${p.difficulty}
          Required Skills: ${p.requiredSkills}
          Tags: ${p.tags}
          Execution Pathways: ${p.suggestedExecutionPathways}
      `).join('\n')}

      Evaluate compatibility based on:
      1. Subject/skill alignment.
      2. Grade level suitability (min/max grades).
      3. Interest match.
      4. Career relevance.

      Return a JSON array of up to 3 objects ranked by suitability.
      Each object must match this schema:
      {
        "projectId": "string (the exact ID of the project)",
        "relevanceScore": "number between 0 and 1",
        "reasoning": "string (detailed explanation of why this fits and how it helps their university portfolio)"
      }
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              projectId: { type: 'STRING' },
              relevanceScore: { type: 'NUMBER' },
              reasoning: { type: 'STRING' }
            },
            required: ['projectId', 'relevanceScore', 'reasoning']
          }
        }
      }
    });

    const rankedList = JSON.parse(response.text);
    return rankedList
      .map(item => {
        const project = projects.find(p => p.id === item.projectId);
        if (!project) return null;
        return {
          ...project,
          relevanceScore: item.relevanceScore,
          reasoning: item.reasoning
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("Error in Gemini project ranking: ", error);
    return fallbackRanking(profile, projects);
  }
};

/**
 * Generate a detailed milestone roadmap for the selected project and pathway.
 */
export const generateMilestones = async (project, selectedPathway, profile, customKey) => {
  const client = getAiClient(customKey);
  if (!client) {
    console.warn("Gemini API key not configured. Falling back to default milestones.");
    return fallbackMilestones(project, selectedPathway);
  }

  try {
    const prompt = `
      You are an expert high school admissions counselor.
      Generate a customized, step-by-step milestone roadmap for a student executing a specific project and pathway.
      
      Student Profile:
      - Grade: ${profile.grade}
      - Skills: ${JSON.stringify(profile.skills)}
      - Interests: ${JSON.stringify(profile.interests)}
      
      Project Details:
      - Title: ${project.title}
      - Description: ${project.description}
      - Category: ${project.category}
      - Selected Execution Pathway: ${selectedPathway}
      
      Generate a sequence of 3-4 milestones suitable for the student's grade level and skills.
      For each milestone, provide:
      1. A professional title.
      2. Clear description of the milestone objective.
      3. A logical sequence order (1-indexed).
      4. Estimated duration (in weeks).
      5. A list of 3-5 specific, actionable sub-tasks.
      6. A list of 2-3 specific learning resources, tools, or websites that will help them (e.g. Coursera, GitHub, Canva, Notion, etc.).

      Return the result strictly in this JSON format:
      {
        "customizationNotes": "Advisor's overall guidance/advice on how to stand out using this project for university admissions.",
        "milestones": [
          {
            "title": "string",
            "description": "string",
            "sequenceOrder": "integer",
            "estimatedDurationWeeks": "integer",
            "tasks": ["string"],
            "resources": ["string"]
          }
        ]
      }
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            customizationNotes: { type: 'STRING' },
            milestones: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  description: { type: 'STRING' },
                  sequenceOrder: { type: 'INTEGER' },
                  estimatedDurationWeeks: { type: 'INTEGER' },
                  tasks: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  },
                  resources: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  }
                },
                required: ['title', 'description', 'sequenceOrder', 'estimatedDurationWeeks', 'tasks', 'resources']
              }
            }
          },
          required: ['customizationNotes', 'milestones']
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error in Gemini milestone generation: ", error);
    return fallbackMilestones(project, selectedPathway);
  }
};

/**
 * Generate a conversational response from Astra guiding the student.
 */
export const generateAdvisorResponse = async (project, pathway, messageHistory, newMessage, profile, customKey) => {
  const client = getAiClient(customKey);
  if (!client) {
    return { text: "AI Advisor is currently offline. Please configure your Gemini API Key in Settings to chat." };
  }

  try {
    const formattedHistory = messageHistory.map(m => 
      `${m.sender === 'USER' ? 'Student' : 'Advisor'}: ${m.message}`
    ).join('\n');

    const prompt = `
      You are Astra, a helpful, encouraging high school admissions project advisor.
      You are guiding the student through their project: "${project.title}" using the pathway: "${pathway}".
      
      Student Profile:
      - Grade: ${profile.grade}
      - Skills: ${JSON.stringify(profile.skills)}
      - Interests: ${JSON.stringify(profile.interests)}

      Conversation History:
      ${formattedHistory}

      Student's New Question:
      "${newMessage}"

      Provide a concise, motivating, and actionable response (1-3 paragraphs) as a college counselor. 
      Suggest specific resources or strategies if appropriate. Address them directly.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return { text: response.text };
  } catch (error) {
    console.error("Error generating advisor chat response: ", error);
    return { text: "I ran into a connection issue while analyzing that. Could you try asking again?" };
  }
};

/**
 * Compile portfolio metrics and alignment scoring.
 */
export const generateUniversityAlignment = async (project, pathway, milestones, profile, customKey) => {
  const client = getAiClient(customKey);
  if (!client) {
    return fallbackAlignment(project, profile);
  }

  try {
    const prompt = `
      You are an elite university admissions consultant.
      Evaluate the student's completed passion project and compile a portfolio alignment report.
      
      Student Profile:
      - Grade: ${profile.grade}
      - Target Universities: ${JSON.stringify(profile.targetUniversities)}
      - Career Goals: ${JSON.stringify(profile.careerGoals)}
      
      Project Details:
      - Title: ${project.title}
      - Pathway: ${pathway}
      
      Milestones and Execution Logs:
      ${milestones.map(ms => `
        - Milestone: ${ms.title}
          Tasks Completed: ${ms.tasks.filter(t => t.isCompleted).map(t => t.title).join(', ')}
          Reflections: ${ms.reflectionLogs.map(l => `Learning: ${l.learningOutcomes}, Challenges: ${l.challenges}, Solutions: ${l.solutions}`).join(' | ')}
      `).join('\n')}

      Evaluate how this project positions the student for their target universities and career goals.
      Specifically, estimate a match score (0-100%) and detail value alignment.

      Return the result strictly in this JSON format:
      {
        "matchScore": "integer (0 to 100)",
        "valueAlignment": "detailed explanation of how the project's outcomes map to university admissions expectations (1-2 paragraphs)",
        "strengthsHighlighted": ["strength 1", "strength 2", "strength 3"],
        "portfolioRecommendations": "actionable advice on how the student should describe or showcase this project in their Common App or interviews"
      }
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            matchScore: { type: 'INTEGER' },
            valueAlignment: { type: 'STRING' },
            strengthsHighlighted: {
              type: 'ARRAY',
              items: { type: 'STRING' }
            },
            portfolioRecommendations: { type: 'STRING' }
          },
          required: ['matchScore', 'valueAlignment', 'strengthsHighlighted', 'portfolioRecommendations']
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error in university alignment scoring: ", error);
    return fallbackAlignment(project, profile);
  }
};

// --- Fallbacks ---

const fallbackRanking = (profile, projects) => {
  const studentGrade = profile.grade || 10;
  const scored = projects.map(p => {
    let score = 0;
    if (studentGrade >= p.minGrade && studentGrade <= p.maxGrade) score += 3;
    const interests = profile.interests || [];
    const projectTags = JSON.parse(p.tags);
    const commonInterests = interests.filter(item => 
      projectTags.some(tag => tag.toLowerCase().includes(item.toLowerCase()))
    );
    score += commonInterests.length * 2;
    const skills = profile.skills || [];
    const requiredSkills = JSON.parse(p.requiredSkills);
    const matchingSkills = skills.filter(item =>
      requiredSkills.some(skill => skill.toLowerCase().includes(item.toLowerCase()))
    );
    score += matchingSkills.length * 1.5;
    return {
      ...p,
      relevanceScore: Math.min(Math.max((score / 10), 0.1), 0.98),
      reasoning: `This project strongly aligns with your interest in ${p.category} and matches your grade profile. It offers an excellent way to practice your skills and build a portfolio for college.`
    };
  });
  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3);
};

const fallbackMilestones = (project, selectedPathway) => {
  return {
    customizationNotes: "Here is your baseline advisor strategy. This layout helps you structure your project milestones efficiently. Try to document each phase to demonstrate your commitment and learning curve to universities.",
    milestones: [
      {
        title: "Research and Planning",
        description: "Research the initial scope of the project, define specific project requirements, and outline the setup details.",
        sequenceOrder: 1,
        estimatedDurationWeeks: 2,
        tasks: [
          "Define specific target audience and project goals",
          "Identify and analyze existing solutions or resources",
          "Create a project design mockup or wireframe"
        ],
        resources: [
          "Google Scholar (research papers)",
          "Notion (project planning template)",
          "YouTube tutorials on local implementation strategies"
        ]
      },
      {
        title: "Development & Execution",
        description: "Produce the core deliverables of your project, applying your skills to build, write, or construct the solution.",
        sequenceOrder: 2,
        estimatedDurationWeeks: 3,
        tasks: [
          "Build the prototype or launch the initial campaign outline",
          "Collect feedback from initial users or community members",
          "Refine deliverables based on primary user inputs"
        ],
        resources: [
          "GitHub (for hosting code if technical)",
          "Canva (for graphic designs and branding)",
          "Trello (for task tracking and scheduling)"
        ]
      },
      {
        title: "Documentation & Completion",
        description: "Write your final reflection log, package the project deliverables, and compile a portfolio-ready report.",
        sequenceOrder: 3,
        estimatedDurationWeeks: 1,
        tasks: [
          "Consolidate learning outcomes and project success metrics",
          "Record a short video walkthrough or write an case-study report",
          "Share the project output on social platforms or with advisors"
        ],
        resources: [
          "Google Docs (for final report creation)",
          "LinkedIn/Resume (updating profile with project accomplishments)"
        ]
      }
    ]
  };
};

const fallbackAlignment = (project, profile) => {
  const unis = profile.targetUniversities || ["interested universities"];
  return {
    matchScore: 82,
    valueAlignment: `Your execution of the "${project.title}" project demonstrates strong independent initiative, practical skill application, and service alignment. These are core values looked for by elite admissions committees at institutions like ${unis.join(', ')}.`,
    strengthsHighlighted: [
      "Project Management & Execution",
      "Problem Solving under Constraint",
      "Goal-Oriented Reflection"
    ],
    portfolioRecommendations: "Describe this project in your activities list by starting with strong action verbs (e.g., 'Designed', 'Launched', 'Audited'). Focus on concrete outcomes (number of users reached, hours of work) and mention the specific technical/soft skills you mastered."
  };
};

