import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { 
  rankProjects, 
  generateMilestones, 
  generateAdvisorResponse, 
  generateUniversityAlignment 
} from './src/services/geminiService.js';

dotenv.config();

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5050;

// Rate limiting setup
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});

app.use(cors());
app.use(express.json());
app.use('/api/', apiLimiter);

// Helper to pull custom API key from request headers
const getCustomApiKey = (req) => {
  return req.headers['x-gemini-api-key'] || null;
};

// Log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Middleware to mock a user (since we use mock/OAuth authentication)
// In a real app, this would verify a Gmail OAuth JWT token
app.use((req, res, next) => {
  const userId = req.headers['x-user-id'] || 'mock-user-id-123';
  req.userId = userId;
  next();
});

// Credit deduction helper
const verifyAndDeductCredits = async (userId, cost) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  if (user.credits < cost) {
    const err = new Error(`Insufficient credits. Requires ${cost} credit(s), but you only have ${user.credits.toFixed(2)}.`);
    err.status = 402;
    err.currentCredits = user.credits;
    err.requiredCredits = cost;
    throw err;
  }
  
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { credits: user.credits - cost }
  });
  return updatedUser;
};

// Create or fetch Mock User
const ensureMockUser = async (userId, email = 'student@example.com', name = 'Jane Doe') => {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, profileDraft: true }
  });

  if (!user) {
    // If not exists, check if email is unique
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { profile: true, profileDraft: true }
    });
    if (existingUser) {
      return existingUser;
    }
    user = await prisma.user.create({
      data: {
        id: userId,
        email,
        name
      },
      include: { profile: true, profileDraft: true }
    });
  }
  return user;
};

// --- AUTH ROUTE ---
app.post('/api/auth/login', async (req, res) => {
  const { email, name } = req.body;
  try {
    const userId = req.headers['x-user-id'] || 'mock-user-id-123';
    const user = await ensureMockUser(userId, email, name);
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        credits: user.credits,
        hasProfile: !!user.profile,
        hasDraft: !!user.profileDraft,
        profileDraft: user.profileDraft ? JSON.parse(user.profileDraft.draftData) : null
      }
    });
  } catch (error) {
    console.error("Auth login error: ", error);
    res.status(500).json({ error: "Failed to authenticate" });
  }
});

// --- BILLING ENDPOINTS ---
app.get('/api/billing/info', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      tier: user.tier,
      credits: user.credits,
      stripeSubscriptionId: user.stripeSubscriptionId
    });
  } catch (error) {
    console.error("Get billing info error: ", error);
    res.status(500).json({ error: "Failed to fetch billing info." });
  }
});

app.post('/api/billing/subscribe', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Upgrade tier and add 100.0 subscription credits
    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: {
        tier: "PREMIUM",
        credits: user.credits + 100.0,
        stripeSubscriptionId: "sub_mock_" + Math.random().toString(36).substr(2, 9)
      }
    });

    res.json({
      success: true,
      message: "Successfully subscribed to Astra Premium! Added 100 credits.",
      user: {
        tier: updatedUser.tier,
        credits: updatedUser.credits
      }
    });
  } catch (error) {
    console.error("Subscribe error: ", error);
    res.status(500).json({ error: "Subscription failed." });
  }
});

app.post('/api/billing/buy-credits', async (req, res) => {
  const { amount } = req.body;
  const creditAmount = parseFloat(amount);
  if (isNaN(creditAmount) || creditAmount <= 0) {
    return res.status(400).json({ error: "Invalid credit amount." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: {
        credits: user.credits + creditAmount
      }
    });

    res.json({
      success: true,
      message: `Successfully purchased ${creditAmount} credits!`,
      user: {
        tier: updatedUser.tier,
        credits: updatedUser.credits
      }
    });
  } catch (error) {
    console.error("Buy credits error: ", error);
    res.status(500).json({ error: "Credit purchase failed." });
  }
});

// --- PROFILE DRAFT ROUTES (Resumable Profile) ---
app.get('/api/profile/draft', async (req, res) => {
  try {
    const draft = await prisma.profileDraft.findUnique({
      where: { userId: req.userId }
    });
    if (!draft) {
      return res.json({ draft: null });
    }
    res.json({ draft: JSON.parse(draft.draftData) });
  } catch (error) {
    console.error("Fetch profile draft error: ", error);
    res.status(500).json({ error: "Failed to fetch profile draft" });
  }
});

app.post('/api/profile/draft', async (req, res) => {
  const { draftData } = req.body;
  try {
    await ensureMockUser(req.userId);
    const draft = await prisma.profileDraft.upsert({
      where: { userId: req.userId },
      update: { draftData: JSON.stringify(draftData) },
      create: { userId: req.userId, draftData: JSON.stringify(draftData) }
    });
    res.json({ success: true, draft: JSON.parse(draft.draftData) });
  } catch (error) {
    console.error("Save profile draft error: ", error);
    res.status(500).json({ error: "Failed to save profile draft" });
  }
});

app.delete('/api/profile/draft', async (req, res) => {
  try {
    await prisma.profileDraft.deleteMany({
      where: { userId: req.userId }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Delete profile draft error: ", error);
    res.status(500).json({ error: "Failed to delete draft" });
  }
});

// --- COMPLETED PROFILE ROUTES ---
app.get('/api/profile', async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });
    if (!profile) {
      return res.status(444).json({ error: "Profile not found" });
    }
    
    // Parse arrays
    res.json({
      ...profile,
      academicSubjects: JSON.parse(profile.academicSubjects),
      interests: JSON.parse(profile.interests),
      careerGoals: JSON.parse(profile.careerGoals),
      extracurriculars: JSON.parse(profile.extracurriculars),
      skills: JSON.parse(profile.skills),
      targetUniversities: JSON.parse(profile.targetUniversities)
    });
  } catch (error) {
    console.error("Fetch profile error: ", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

app.post('/api/profile', async (req, res) => {
  const {
    grade,
    academicSubjects,
    interests,
    careerGoals,
    extracurriculars,
    skills,
    targetUniversities
  } = req.body;

  try {
    await ensureMockUser(req.userId);

    // Create or update completed profile
    const profile = await prisma.profile.upsert({
      where: { userId: req.userId },
      update: {
        grade: parseInt(grade),
        academicSubjects: JSON.stringify(academicSubjects),
        interests: JSON.stringify(interests),
        careerGoals: JSON.stringify(careerGoals),
        extracurriculars: JSON.stringify(extracurriculars),
        skills: JSON.stringify(skills),
        targetUniversities: JSON.stringify(targetUniversities)
      },
      create: {
        userId: req.userId,
        grade: parseInt(grade),
        academicSubjects: JSON.stringify(academicSubjects),
        interests: JSON.stringify(interests),
        careerGoals: JSON.stringify(careerGoals),
        extracurriculars: JSON.stringify(extracurriculars),
        skills: JSON.stringify(skills),
        targetUniversities: JSON.stringify(targetUniversities)
      }
    });

    // Delete the draft once profile is finalized
    await prisma.profileDraft.deleteMany({
      where: { userId: req.userId }
    });

    res.json({ success: true, profile });
  } catch (error) {
    console.error("Save profile error: ", error);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// --- PROJECT RECOMMENDATION ROUTE (Phase 3) ---
app.get('/api/projects/suggestions', async (req, res) => {
  try {
    // 1. Fetch user profile
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile) {
      return res.status(400).json({ error: "Please complete your profile first." });
    }

    // Verify and deduct 1.0 credits
    await verifyAndDeductCredits(req.userId, 1.0);

    // Parse the lists
    const parsedProfile = {
      ...profile,
      academicSubjects: JSON.parse(profile.academicSubjects),
      interests: JSON.parse(profile.interests),
      careerGoals: JSON.parse(profile.careerGoals),
      extracurriculars: JSON.parse(profile.extracurriculars),
      skills: JSON.parse(profile.skills),
      targetUniversities: JSON.parse(profile.targetUniversities)
    };

    // 2. Fetch all curated projects
    const allProjects = await prisma.projectDB.findMany();

    // 3. Rank via Gemini service
    const customKey = getCustomApiKey(req);
    const rankedSuggestions = await rankProjects(parsedProfile, allProjects, customKey);
    res.json({ suggestions: rankedSuggestions });
  } catch (error) {
    if (error.status === 402) {
      return res.status(402).json({ error: error.message, currentCredits: error.currentCredits, requiredCredits: error.requiredCredits });
    }
    console.error("Error fetching project suggestions: ", error);
    res.status(500).json({ error: "Failed to generate project suggestions." });
  }
});

// --- SELECT PROJECT & GENERATE ROADMAP (Phase 3/4) ---
app.post('/api/projects/select', async (req, res) => {
  const { projectId, selectedPathway, customizationNotes } = req.body;

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile) {
      return res.status(400).json({ error: "Please complete your profile first." });
    }

    // Verify and deduct 1.0 credits
    await verifyAndDeductCredits(req.userId, 1.0);

    const parsedProfile = {
      ...profile,
      skills: JSON.parse(profile.skills),
      interests: JSON.parse(profile.interests)
    };

    const project = await prisma.projectDB.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: "Curated project not found." });
    }

    // 1. Terminate/Archive any existing active project
    await prisma.userProject.updateMany({
      where: { userId: req.userId, status: "IN_PROGRESS" },
      data: { status: "ABANDONED" }
    });

    // 2. Generate detailed milestones via Gemini
    const customKey = getCustomApiKey(req);
    const roadmap = await generateMilestones(project, selectedPathway, parsedProfile, customKey);

    // 3. Store in DB
    const userProject = await prisma.userProject.create({
      data: {
        userId: req.userId,
        projectId,
        selectedPathway,
        customizationNotes: roadmap.customizationNotes || customizationNotes,
        status: "IN_PROGRESS"
      }
    });

    // Create Milestones and Tasks
    for (const ms of roadmap.milestones) {
      const milestone = await prisma.milestone.create({
        data: {
          userProjectId: userProject.id,
          title: ms.title,
          description: ms.description,
          sequenceOrder: ms.sequenceOrder,
          estimatedDurationWeeks: ms.estimatedDurationWeeks,
          status: ms.sequenceOrder === 1 ? "IN_PROGRESS" : "NOT_STARTED"
        }
      });

      // Create tasks
      for (const tTitle of ms.tasks) {
        await prisma.task.create({
          data: {
            milestoneId: milestone.id,
            title: tTitle,
            isCompleted: false
          }
        });
      }
    }

    const completedUserProject = await prisma.userProject.findUnique({
      where: { id: userProject.id },
      include: {
        project: true,
        milestones: {
          include: { tasks: true, reflectionLogs: true },
          orderBy: { sequenceOrder: 'asc' }
        }
      }
    });

    res.json({ success: true, userProject: completedUserProject });
  } catch (error) {
    if (error.status === 402) {
      return res.status(402).json({ error: error.message, currentCredits: error.currentCredits, requiredCredits: error.requiredCredits });
    }
    console.error("Select project error: ", error);
    res.status(500).json({ error: "Failed to select project and build milestones." });
  }
});

// --- GET ACTIVE PROJECT ---
app.get('/api/projects/active', async (req, res) => {
  try {
    const activeProject = await prisma.userProject.findFirst({
      where: { userId: req.userId, status: "IN_PROGRESS" },
      include: {
        project: true,
        milestones: {
          include: { tasks: true, reflectionLogs: true },
          orderBy: { sequenceOrder: 'asc' }
        }
      }
    });

    res.json({ activeProject });
  } catch (error) {
    console.error("Get active project error: ", error);
    res.status(500).json({ error: "Failed to fetch active project." });
  }
});

// --- ACTIVE PROJECT CHAT ADVISOR ENDPOINTS ---
app.get('/api/projects/active/chat', async (req, res) => {
  try {
    const activeProject = await prisma.userProject.findFirst({
      where: { userId: req.userId, status: "IN_PROGRESS" }
    });
    if (!activeProject) {
      return res.status(404).json({ error: "No active project found." });
    }
    const chatMessages = await prisma.chatMessage.findMany({
      where: { userProjectId: activeProject.id },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ chatMessages });
  } catch (error) {
    console.error("Fetch chat messages error: ", error);
    res.status(500).json({ error: "Failed to fetch chat history." });
  }
});

app.post('/api/projects/active/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message cannot be empty." });
  }

  try {
    // Verify and deduct 0.1 credits for advisor message response
    await verifyAndDeductCredits(req.userId, 0.1);

    const activeProject = await prisma.userProject.findFirst({
      where: { userId: req.userId, status: "IN_PROGRESS" },
      include: { project: true }
    });

    if (!activeProject) {
      return res.status(404).json({ error: "No active project found." });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found." });
    }

    const parsedProfile = {
      ...profile,
      skills: JSON.parse(profile.skills),
      interests: JSON.parse(profile.interests)
    };

    // Fetch chat history for context (up to last 15 messages)
    const chatHistory = await prisma.chatMessage.findMany({
      where: { userProjectId: activeProject.id },
      orderBy: { createdAt: 'asc' },
      take: 15
    });

    // Save user message in DB
    const userMsg = await prisma.chatMessage.create({
      data: {
        userProjectId: activeProject.id,
        sender: "USER",
        message
      }
    });

    // Generate response from Gemini
    const customKey = getCustomApiKey(req);
    const result = await generateAdvisorResponse(
      activeProject.project,
      activeProject.selectedPathway,
      chatHistory,
      message,
      parsedProfile,
      customKey
    );

    // Save advisor response in DB
    const advisorMsg = await prisma.chatMessage.create({
      data: {
        userProjectId: activeProject.id,
        sender: "ADVISOR",
        message: result.text
      }
    });

    res.json({ success: true, message: advisorMsg });
  } catch (error) {
    if (error.status === 402) {
      return res.status(402).json({ error: error.message, currentCredits: error.currentCredits, requiredCredits: error.requiredCredits });
    }
    console.error("Chat advisor error: ", error);
    res.status(500).json({ error: "AI advisor failed to reply." });
  }
});

// --- TOGGLE TASK ---
app.post('/api/tasks/:id/toggle', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id }
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: { isCompleted: !task.isCompleted }
    });

    res.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error("Toggle task error: ", error);
    res.status(500).json({ error: "Failed to toggle task status." });
  }
});

// --- SUBMIT REFLECTION LOG ---
app.post('/api/milestones/:id/log', async (req, res) => {
  const { learningOutcomes, challenges, solutions, resourcesUsed, mediaLinks, completeMilestone } = req.body;

  try {
    const milestone = await prisma.milestone.findUnique({
      where: { id: req.params.id }
    });

    if (!milestone) {
      return res.status(404).json({ error: "Milestone not found" });
    }

    // Save reflection log
    const log = await prisma.reflectionLog.create({
      data: {
        milestoneId: milestone.id,
        learningOutcomes,
        challenges,
        solutions,
        resourcesUsed,
        mediaLinks: mediaLinks ? JSON.stringify(mediaLinks) : null
      }
    });

    // Optionally complete the milestone and activate the next one
    if (completeMilestone) {
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { status: "COMPLETED" }
      });

      // Find the next milestone in sequence
      const nextMilestone = await prisma.milestone.findFirst({
        where: {
          userProjectId: milestone.userProjectId,
          sequenceOrder: milestone.sequenceOrder + 1
        }
      });

      if (nextMilestone) {
        await prisma.milestone.update({
          where: { id: nextMilestone.id },
          data: { status: "IN_PROGRESS" }
        });
      }
    }

    res.json({ success: true, log });
  } catch (error) {
    console.error("Submit log error: ", error);
    res.status(500).json({ error: "Failed to submit reflection log." });
  }
});

// --- COMPLETE PROJECT ---
app.post('/api/projects/active/complete', async (req, res) => {
  try {
    const activeProject = await prisma.userProject.findFirst({
      where: { userId: req.userId, status: "IN_PROGRESS" },
      include: {
        project: true,
        milestones: {
          include: {
            tasks: true,
            reflectionLogs: true
          }
        }
      }
    });

    if (!activeProject) {
      return res.status(404).json({ error: "No active project to complete." });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile) {
      return res.status(400).json({ error: "Please complete your profile first." });
    }

    // Verify and deduct 2.0 credits for university alignment report evaluation
    await verifyAndDeductCredits(req.userId, 2.0);

    const parsedProfile = {
      ...profile,
      targetUniversities: JSON.parse(profile.targetUniversities),
      careerGoals: JSON.parse(profile.careerGoals)
    };

    // Generate alignment scoring report via Gemini
    const customKey = getCustomApiKey(req);
    const alignmentDetails = await generateUniversityAlignment(
      activeProject.project,
      activeProject.selectedPathway,
      activeProject.milestones,
      parsedProfile,
      customKey
    );

    // 1. Mark project as completed and save alignment report details
    const updatedProject = await prisma.userProject.update({
      where: { id: activeProject.id },
      data: { 
        status: "COMPLETED",
        alignmentScoreDetails: JSON.stringify(alignmentDetails)
      }
    });

    // 2. Mark all milestones as completed
    await prisma.milestone.updateMany({
      where: { userProjectId: activeProject.id },
      data: { status: "COMPLETED" }
    });

    res.json({ success: true, project: updatedProject });
  } catch (error) {
    if (error.status === 402) {
      return res.status(402).json({ error: error.message, currentCredits: error.currentCredits, requiredCredits: error.requiredCredits });
    }
    console.error("Complete project error: ", error);
    res.status(500).json({ error: "Failed to mark project completed." });
  }
});

// --- GET PORTFOLIO REPORT ---
app.get('/api/projects/portfolio/:id', async (req, res) => {
  try {
    const project = await prisma.userProject.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        user: {
          include: { profile: true }
        },
        milestones: {
          include: {
            tasks: true,
            reflectionLogs: true
          },
          orderBy: { sequenceOrder: 'asc' }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ portfolio: project });
  } catch (error) {
    console.error("Get portfolio error: ", error);
    res.status(500).json({ error: "Failed to compile portfolio report." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Astra backend listening on port ${PORT}`);
});
