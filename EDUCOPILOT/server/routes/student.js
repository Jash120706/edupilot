const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/authMiddleware');
const StudyPlan = require('../models/StudyPlan');
const TestAttempt = require('../models/TestAttempt');
const Doubt = require('../models/Doubt');
const { generateChatCompletion } = require('../services/groqService');
const { retrieveRelevantChunks, formatGroundedContext, ingestDocument } = require('../services/ragService');
const { extractTextFromFile } = require('../services/fileParserService');

// Multer memory storage for student uploads (PDF, Text, Timetables, Study materials)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
});

// All student routes are protected and restricted to student role
router.use(protect);
router.use(authorize('student'));

// ==========================================
// 1. STUDENT DASHBOARD
// ==========================================
router.get('/dashboard', async (req, res) => {
  try {
    const studentId = req.user._id;

    const [studyPlans, testAttempts, doubts] = await Promise.all([
      StudyPlan.find({ userId: studentId }).sort({ createdAt: -1 }).limit(5),
      TestAttempt.find({ userId: studentId }).sort({ completedAt: -1 }).limit(10),
      Doubt.find({ userId: studentId }).sort({ createdAt: -1 }).limit(5),
    ]);

    const totalPlans = await StudyPlan.countDocuments({ userId: studentId });
    const totalTests = await TestAttempt.countDocuments({ userId: studentId });
    const totalDoubts = await Doubt.countDocuments({ userId: studentId });

    // Calculate average test percentage
    let avgScore = 0;
    const weakAreasSet = new Set();
    const strengthsSet = new Set();

    if (testAttempts.length > 0) {
      const sum = testAttempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
      avgScore = Math.round(sum / testAttempts.length);
      testAttempts.forEach((t) => {
        t.weakAreas?.forEach((w) => weakAreasSet.add(w));
        t.strengths?.forEach((s) => strengthsSet.add(s));
      });
    }

    res.json({
      stats: {
        totalPlans,
        totalTests,
        totalDoubts,
        avgScore,
        weakAreas: Array.from(weakAreasSet).slice(0, 5),
        strengths: Array.from(strengthsSet).slice(0, 5),
      },
      recentPlans: studyPlans,
      recentTests: testAttempts,
      recentDoubts: doubts,
    });
  } catch (error) {
    console.error('[StudentDashboard] Error:', error);
    res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
});

// ==========================================
// 2. STUDENT STUDY PLANNER (MULTI-FILE UPLOAD, PRIORITIES & CUSTOMIZABLE)
// ==========================================
// @route   POST /api/student/study-plans/generate-from-materials
// @desc    Generate personalized study plan from uploaded syllabus, timetable, course outline, or study material
router.post(
  '/study-plans/generate-from-materials',
  upload.fields([
    { name: 'syllabusFile', maxCount: 1 },
    { name: 'timetableFile', maxCount: 1 },
    { name: 'studyMaterialFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        subject = 'Computer Science',
        topic = 'Semester Exam Preparation',
        targetExamDate = '',
        durationDays = 7,
        rawNotes = '',
      } = req.body;

      let extractedContext = rawNotes || '';

      // Process uploaded syllabus
      if (req.files?.syllabusFile?.[0]) {
        const file = req.files.syllabusFile[0];
        const text = await extractTextFromFile({
          fileBuffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
        });
        extractedContext += `\n[UPLOADED SYLLABUS: ${file.originalname}]\n${text}`;
        await ingestDocument({
          uploadedBy: req.user._id,
          docTitle: `Syllabus - ${file.originalname.replace(/\.[^/.]+$/, '')}`,
          subject,
          rawText: text,
        });
      }

      // Process uploaded timetable / exam schedule
      if (req.files?.timetableFile?.[0]) {
        const file = req.files.timetableFile[0];
        const text = await extractTextFromFile({
          fileBuffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
        });
        extractedContext += `\n[TIMETABLE & EXAM SCHEDULE: ${file.originalname}]\n${text}`;
      }

      // Process uploaded study material
      if (req.files?.studyMaterialFile?.[0]) {
        const file = req.files.studyMaterialFile[0];
        const text = await extractTextFromFile({
          fileBuffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
        });
        extractedContext += `\n[COURSE STUDY MATERIAL: ${file.originalname}]\n${text}`;
        await ingestDocument({
          uploadedBy: req.user._id,
          docTitle: `Study Material - ${file.originalname.replace(/\.[^/.]+$/, '')}`,
          subject,
          rawText: text,
        });
      }

      // Retrieve additional context from student's isolated RAG vault
      const relevantChunks = await retrieveRelevantChunks({
        subject,
        query: `${topic} ${subject} syllabus curriculum exam roadmap`,
        topK: 3,
        userId: req.user._id,
      });
      const groundedContext = formatGroundedContext(relevantChunks);

      const prompt = `You are an Expert AI Academic Coach creating a personalized, high-yield study planner for a student.
Subject: ${subject}
Focus Topic / Goal: ${topic}
Target Exam Date: ${targetExamDate || 'Upcoming Exam'}
Schedule Duration: ${durationDays} days

UPLOADED COURSE SYLLABUS, TIMETABLE & STUDY MATERIAL:
"""
${(extractedContext + '\n\n' + groundedContext).slice(0, 7000)}
"""

Instructions:
1. Generate an actionable, day-by-day study roadmap for ${durationDays} days.
2. For each day, assign:
   - day number
   - title
   - subject
   - focus objective
   - priority level ("High", "Medium", or "Low")
   - recommended daily study time in minutes (e.g. 60, 90, 120)
   - scheduled date (sequential dates starting from today or target exam timeline)
   - 2-4 concrete, actionable daily tasks
3. Synthesize a concise topic summary and formatted Markdown revision notes.

Return ONLY valid JSON matching this exact structure:
{
  "topicSummary": "Concise high-yield topic overview",
  "planDays": [
    {
      "day": 1,
      "title": "Core Foundations & Axioms",
      "subject": "${subject}",
      "focus": "Mastering fundamental definitions and basic proofs",
      "priority": "High",
      "scheduledDate": "${new Date().toISOString().split('T')[0]}",
      "recommendedStudyMinutes": 90,
      "tasks": ["Read Chapter 1 notes", "Solve 5 foundational problems", "Draft summary flashcards"]
    }
  ],
  "revisionNotes": "Markdown formatted cheat sheet with key formulas, core theorems, and common traps."
}`;

      const completion = await generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are an academic study planner. Output strictly JSON.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      let parsed;
      try {
        parsed = JSON.parse(completion);
      } catch (err) {
        const jsonMatch = completion.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      }

      const planDaysWithStatus = (parsed?.planDays || []).map((d) => ({
        ...d,
        completed: false,
      }));

      const plan = await StudyPlan.create({
        userId: req.user._id,
        subject,
        topic,
        targetExamDate: targetExamDate || '',
        syllabusRef: req.files?.syllabusFile?.[0]?.originalname || 'Uploaded Material',
        durationDays: Number(durationDays),
        planDays: planDaysWithStatus,
        topicSummary: parsed?.topicSummary || 'Personalized study schedule.',
        revisionNotes: parsed?.revisionNotes || 'Review key concepts and formulas.',
        progressPercent: 0,
      });

      res.status(201).json(plan);
    } catch (error) {
      console.error('[StudyPlanGenerateFromMaterials] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate study plan.' });
    }
  }
);

// Standard post route alias
router.post('/study-plans', async (req, res) => {
  try {
    const { subject, topic, targetExamDate, durationDays = 7, syllabusRef = '' } = req.body;

    const relevantChunks = await retrieveRelevantChunks({
      subject,
      query: `${topic} ${syllabusRef}`,
      topK: 3,
      userId: req.user._id,
    });
    const groundedContext = formatGroundedContext(relevantChunks);

    const prompt = `You are an expert AI Academic Coach generating an individualized study plan for a student.
Subject: ${subject}
Topic / Exam Goal: ${topic}
Target Exam Date: ${targetExamDate || 'Upcoming Exam'}
Duration: ${durationDays} days
Syllabus / Reference Notes: ${syllabusRef || 'Standard Curriculum'}

COURSE REFERENCE MATERIALS (GROUNDING CONTEXT):
${groundedContext}

Generate ${durationDays}-day schedule. Return ONLY valid JSON:
{
  "topicSummary": "Overview",
  "planDays": [
    {
      "day": 1,
      "title": "Title",
      "subject": "${subject}",
      "focus": "Focus",
      "priority": "High",
      "scheduledDate": "${new Date().toISOString().split('T')[0]}",
      "recommendedStudyMinutes": 90,
      "tasks": ["Task 1", "Task 2"]
    }
  ],
  "revisionNotes": "Markdown revision notes"
}`;

    const completion = await generateChatCompletion({
      messages: [
        { role: 'system', content: 'You are an academic mentor. Output ONLY JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    let parsed;
    try {
      parsed = JSON.parse(completion);
    } catch (err) {
      const match = completion.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    const plan = await StudyPlan.create({
      userId: req.user._id,
      subject,
      topic,
      targetExamDate: targetExamDate || '',
      syllabusRef,
      durationDays,
      planDays: parsed?.planDays || [],
      topicSummary: parsed?.topicSummary || '',
      revisionNotes: parsed?.revisionNotes || '',
      progressPercent: 0,
    });

    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to generate study plan.' });
  }
});

// @route   PUT /api/student/study-plans/:id
// @desc    Edit study plan days, tasks, priorities, or study minutes
router.put('/study-plans/:id', async (req, res) => {
  try {
    const { topic, targetExamDate, planDays, topicSummary, revisionNotes } = req.body;
    const plan = await StudyPlan.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!plan) {
      return res.status(404).json({ error: 'Study plan not found or access denied.' });
    }

    if (topic) plan.topic = topic;
    if (targetExamDate !== undefined) plan.targetExamDate = targetExamDate;
    if (topicSummary !== undefined) plan.topicSummary = topicSummary;
    if (revisionNotes !== undefined) plan.revisionNotes = revisionNotes;
    if (planDays && Array.isArray(planDays)) {
      plan.planDays = planDays;
      const completedCount = planDays.filter((d) => d.completed).length;
      plan.progressPercent = Math.round((completedCount / (planDays.length || 1)) * 100);
    }

    await plan.save();
    res.json(plan);
  } catch (error) {
    console.error('[StudyPlanEdit] Error:', error);
    res.status(500).json({ error: 'Failed to update study plan.' });
  }
});

// @route   GET /api/student/study-plans
// @desc    List all study plans for the logged-in student
router.get('/study-plans', async (req, res) => {
  try {
    const plans = await StudyPlan.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch study plans.' });
  }
});

// @route   GET /api/student/study-plans/:id
// @desc    Get single study plan
router.get('/study-plans/:id', async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!plan) {
      return res.status(404).json({ error: 'Study plan not found.' });
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch study plan.' });
  }
});

// @route   PATCH /api/student/study-plans/:id/toggle-task
// @desc    Toggle completion of a daily plan task
router.patch('/study-plans/:id/toggle-task', async (req, res) => {
  try {
    const { dayIndex } = req.body;
    const plan = await StudyPlan.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!plan) {
      return res.status(404).json({ error: 'Study plan not found.' });
    }

    if (plan.planDays[dayIndex]) {
      plan.planDays[dayIndex].completed = !plan.planDays[dayIndex].completed;
      const completedCount = plan.planDays.filter((d) => d.completed).length;
      plan.progressPercent = Math.round((completedCount / plan.planDays.length) * 100);
      await plan.save();
    }

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task status.' });
  }
});

// ==========================================
// 3. STUDENT MATERIAL-BASED SAMPLE TEST (MCQs, TRUE/FALSE, FILL-BLANK, SHORT-ANSWER)
// ==========================================
// @route   POST /api/student/tests/generate-from-material
// @desc    Generate multi-type test questions from uploaded material or RAG vault
router.post('/tests/generate-from-material', upload.single('file'), async (req, res) => {
  try {
    const {
      subject = 'Computer Science',
      topic = 'Comprehensive Exam',
      difficulty = 'Medium',
      questionCount = 5,
      questionType = 'Mixed', // 'MCQ' | 'TrueFalse' | 'FillBlank' | 'ShortAnswer' | 'Mixed'
      rawText = '',
    } = req.body;

    let materialContent = rawText || '';

    // If student attached a document directly to the quiz generator
    if (req.file) {
      materialContent = await extractTextFromFile({
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      });

      if (materialContent && materialContent.trim().length > 20) {
        await ingestDocument({
          uploadedBy: req.user._id,
          docTitle: req.file.originalname.replace(/\.[^/.]+$/, ''),
          subject,
          rawText: materialContent,
        });
      }
    }

    // Retrieve from student's private RAG vault
    const relevantChunks = await retrieveRelevantChunks({
      subject,
      query: `${topic} ${materialContent.slice(0, 200)} practice examination questions`,
      topK: 3,
      userId: req.user._id,
    });
    let groundedContext = formatGroundedContext(relevantChunks);
    if (materialContent && materialContent.trim().length > 20) {
      groundedContext = `[ATTACHED STUDY MATERIAL]\n${materialContent.slice(0, 4000)}\n\n` + groundedContext;
    }

    // Retrieve past weak areas for adaptive question formulation
    const pastAttempts = await TestAttempt.find({ userId: req.user._id })
      .sort({ completedAt: -1 })
      .limit(3);
    const knownWeakAreas = [];
    pastAttempts.forEach((p) => p.weakAreas?.forEach((w) => knownWeakAreas.push(w)));

    const prompt = `You are an Expert AI Examiner creating a high-quality practice test for a student grounded strictly in their study material.
Subject: ${subject}
Topic: ${topic}
Difficulty Level: ${difficulty}
Total Questions: ${questionCount}
Question Type Format: ${questionType} (Support MCQ, TrueFalse, FillBlank, and ShortAnswer)
Student's Known Historical Weak Areas: ${knownWeakAreas.length > 0 ? knownWeakAreas.join(', ') : 'None recorded'}

STUDY MATERIAL REFERENCE (GROUNDING):
${groundedContext}

Instructions:
Create exactly ${questionCount} questions grounded in the material.
Supported questionType values:
- "MCQ": options (4 choices), correctAnswerIndex (0-3), explanation
- "TrueFalse": options (["True", "False"]), correctAnswerIndex (0 or 1), explanation
- "FillBlank": question with a blank "_____", correctTextAnswer (the exact term), explanation
- "ShortAnswer": question requiring 1-3 sentences, correctTextAnswer (model answer & key points), explanation

Return ONLY valid JSON matching this exact structure:
{
  "questions": [
    {
      "questionType": "MCQ",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "correctTextAnswer": "Option A",
      "points": 2,
      "explanation": "Clear explanation of why this is correct.",
      "topicTag": "Subtopic Name"
    },
    {
      "questionType": "FillBlank",
      "question": "In the Raft protocol, leader election uses randomized _____ between 150ms and 300ms.",
      "options": [],
      "correctAnswerIndex": 0,
      "correctTextAnswer": "election timers",
      "points": 2,
      "explanation": "Randomized election timers prevent split votes in consensus.",
      "topicTag": "Consensus Protocols"
    },
    {
      "questionType": "ShortAnswer",
      "question": "Explain how Dijkstra algorithm avoids cycles in shortest-path trees.",
      "options": [],
      "correctAnswerIndex": 0,
      "correctTextAnswer": "Maintains visited set and greedily extracts minimum distance vertex from priority queue.",
      "points": 4,
      "explanation": "Greedy relaxation with non-negative edge weights guarantees optimal substructure.",
      "topicTag": "Graph Algorithms"
    }
  ]
}`;

    const completion = await generateChatCompletion({
      messages: [
        { role: 'system', content: 'You are an examination engine. Output strictly JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    let parsed;
    try {
      parsed = JSON.parse(completion);
    } catch (err) {
      const match = completion.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { questions: [] };
    }

    res.json({
      subject,
      topic,
      difficulty,
      questionTypeFilter: questionType,
      sourceMaterialTitle: req.file?.originalname || 'Personal Knowledge Vault',
      questions: parsed?.questions || [],
    });
  } catch (error) {
    console.error('[TestGenerateFromMaterial] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate test.' });
  }
});

// Standard generate test alias
router.post('/tests/generate', async (req, res) => {
  try {
    const { subject, topic, difficulty = 'Medium', questionCount = 4 } = req.body;
    const relevantChunks = await retrieveRelevantChunks({
      subject,
      query: `${topic} practice test`,
      topK: 3,
      userId: req.user._id,
    });
    const groundedContext = formatGroundedContext(relevantChunks);

    const prompt = `Create ${questionCount} multiple choice practice questions on "${topic}" for ${subject} (${difficulty}).
COURSE GROUNDING:
${groundedContext}
Return JSON matching: {"questions": [{"questionType": "MCQ", "question": "...", "options": ["A","B","C","D"], "correctAnswerIndex": 0, "correctTextAnswer": "...", "points": 1, "explanation": "...", "topicTag": "..."}]}`;

    const completion = await generateChatCompletion({
      messages: [
        { role: 'system', content: 'You are an examination engine. Output JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    let parsed;
    try {
      parsed = JSON.parse(completion);
    } catch (err) {
      const match = completion.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { questions: [] };
    }

    res.json({
      subject,
      topic,
      difficulty,
      questions: parsed?.questions || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to generate test.' });
  }
});

// ==========================================
// 4. STUDENT TEST EVALUATION (OBJECTIVE + SUBJECTIVE RUBRICS + REVISION TOPICS)
// ==========================================
// @route   POST /api/student/tests/submit-comprehensive
// @desc    Submit test answers (evaluates objective + short answers with RAG, computes strengths/weaknesses & revision recommendations)
router.post('/tests/submit-comprehensive', async (req, res) => {
  try {
    const {
      subject,
      topic,
      difficulty = 'Medium',
      questionTypeFilter = 'Mixed',
      sourceMaterialTitle = '',
      questions,
      userAnswers = {},
      timeTakenSeconds = 0,
    } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Invalid test submission.' });
    }

    let totalScore = 0;
    let totalMaxPoints = 0;

    // Evaluate each question
    const evaluatedQuestions = [];
    const subjectiveEvaluationsNeeded = [];

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const maxPts = Number(q.points) || 1;
      totalMaxPoints += maxPts;

      const submission = userAnswers[idx];
      const qType = q.questionType || 'MCQ';

      if (qType === 'MCQ' || qType === 'TrueFalse') {
        // Deterministic matching
        const selectedOpt = typeof submission === 'number' ? submission : parseInt(submission, 10);
        const isCorrect = selectedOpt === q.correctAnswerIndex;
        const awarded = isCorrect ? maxPts : 0;
        totalScore += awarded;

        evaluatedQuestions.push({
          questionId: q.questionId,
          questionType: qType,
          question: q.question,
          options: q.options || [],
          correctAnswerIndex: q.correctAnswerIndex,
          correctTextAnswer: q.options?.[q.correctAnswerIndex] || q.correctTextAnswer || '',
          userSelectedOption: selectedOpt,
          userTextAnswer: q.options?.[selectedOpt] || '',
          isCorrect,
          points: maxPts,
          awardedPoints: awarded,
          explanation: q.explanation,
          rubricFeedback: isCorrect ? 'Correct selection.' : `Incorrect. Expected ${q.options?.[q.correctAnswerIndex]}`,
          topicTag: q.topicTag || topic,
        });
      } else if (qType === 'FillBlank') {
        // Deterministic text matching
        const userText = (typeof submission === 'string' ? submission : '').trim().toLowerCase();
        const correctText = (q.correctTextAnswer || '').trim().toLowerCase();
        const isCorrect = userText.length > 0 && (userText === correctText || correctText.includes(userText));
        const awarded = isCorrect ? maxPts : 0;
        totalScore += awarded;

        evaluatedQuestions.push({
          questionId: q.questionId,
          questionType: qType,
          question: q.question,
          options: [],
          correctAnswerIndex: 0,
          correctTextAnswer: q.correctTextAnswer,
          userSelectedOption: null,
          userTextAnswer: typeof submission === 'string' ? submission : '',
          isCorrect,
          points: maxPts,
          awardedPoints: awarded,
          explanation: q.explanation,
          rubricFeedback: isCorrect ? 'Exact keyword match!' : `Expected: "${q.correctTextAnswer}"`,
          topicTag: q.topicTag || topic,
        });
      } else {
        // Subjective (ShortAnswer / Descriptive)
        subjectiveEvaluationsNeeded.push({
          index: idx,
          question: q.question,
          studentAnswer: typeof submission === 'string' ? submission : '',
          modelAnswer: q.correctTextAnswer || q.explanation,
          maxPoints: maxPts,
          topicTag: q.topicTag || topic,
        });
      }
    }

    // If there are subjective short answers, evaluate them using Groq + RAG
    if (subjectiveEvaluationsNeeded.length > 0) {
      const subjectivePrompt = `You are an AI Examination Evaluator grading student short-answer responses.
Subject: ${subject}
Topic: ${topic}

QUESTIONS AND STUDENT SUBMISSIONS TO EVALUATE:
${JSON.stringify(subjectiveEvaluationsNeeded, null, 2)}

Instructions:
Evaluate each short-answer based on conceptual accuracy, key terms, and logical completeness against the model answer.
Award points (0 to maxPoints), determine isCorrect (awarded >= 60% of maxPoints), and provide constructive feedback.
Return ONLY valid JSON matching:
{
  "evaluatedSubjectives": [
    {
      "index": 0,
      "awardedPoints": 3,
      "isCorrect": true,
      "rubricFeedback": "Good reasoning on core invariants.",
      "improvementTip": "Mention boundary conditions."
    }
  ]
}`;

      const evalCompletion = await generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are an academic evaluator. Output JSON.' },
          { role: 'user', content: subjectivePrompt },
        ],
        response_format: { type: 'json_object' },
      });

      let parsedSubj;
      try {
        parsedSubj = JSON.parse(evalCompletion);
      } catch (err) {
        const match = evalCompletion.match(/\{[\s\S]*\}/);
        parsedSubj = match ? JSON.parse(match[0]) : { evaluatedSubjectives: [] };
      }

      const subjMap = {};
      (parsedSubj?.evaluatedSubjectives || []).forEach((item) => {
        subjMap[item.index] = item;
      });

      subjectiveEvaluationsNeeded.forEach((item) => {
        const result = subjMap[item.index] || {
          awardedPoints: Math.round(item.maxPoints * 0.7),
          isCorrect: true,
          rubricFeedback: 'Reasonable conceptual response.',
        };

        totalScore += Number(result.awardedPoints || 0);

        evaluatedQuestions.push({
          questionId: questions[item.index].questionId,
          questionType: questions[item.index].questionType || 'ShortAnswer',
          question: item.question,
          options: [],
          correctAnswerIndex: 0,
          correctTextAnswer: item.modelAnswer,
          userSelectedOption: null,
          userTextAnswer: item.studentAnswer,
          isCorrect: result.isCorrect,
          points: item.maxPoints,
          awardedPoints: result.awardedPoints,
          explanation: questions[item.index].explanation,
          rubricFeedback: result.rubricFeedback,
          topicTag: item.topicTag,
        });
      });
    }

    // Sort evaluated questions back into original index order
    evaluatedQuestions.sort((a, b) => {
      const idxA = questions.findIndex((q) => q.question === a.question);
      const idxB = questions.findIndex((q) => q.question === b.question);
      return idxA - idxB;
    });

    const percentage = Math.round((totalScore / (totalMaxPoints || 1)) * 100);

    // Identify weak areas and strengths
    const missedTopics = evaluatedQuestions.filter((q) => !q.isCorrect).map((q) => q.topicTag);
    const correctTopics = evaluatedQuestions.filter((q) => q.isCorrect).map((q) => q.topicTag);
    const weakAreas = Array.from(new Set(missedTopics));
    const strengths = Array.from(new Set(correctTopics));

    // Generate AI Diagnostic feedback & Recommended Topics for Revision
    const diagnosticPrompt = `A student completed a practice test on "${topic}" in "${subject}".
Score: ${totalScore}/${totalMaxPoints} (${percentage}%)
Mastered Subtopics: ${strengths.join(', ') || 'None yet'}
Missed/Weak Subtopics: ${weakAreas.join(', ') || 'None (100% Score!)'}

Instructions:
1. Provide a constructive 2-sentence diagnostic feedback summary.
2. List 2-3 specific "recommendedRevisionTopics" for the student to review next.

Return ONLY valid JSON:
{
  "aiDiagnosticFeedback": "Feedback here",
  "recommendedRevisionTopics": ["Revision Topic 1", "Revision Topic 2"]
}`;

    const diagCompletion = await generateChatCompletion({
      messages: [
        { role: 'system', content: 'You are an academic diagnostics coach. Output JSON.' },
        { role: 'user', content: diagnosticPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    let parsedDiag;
    try {
      parsedDiag = JSON.parse(diagCompletion);
    } catch (err) {
      const match = diagCompletion.match(/\{[\s\S]*\}/);
      parsedDiag = match ? JSON.parse(match[0]) : null;
    }

    const testAttempt = await TestAttempt.create({
      userId: req.user._id,
      subject,
      topic,
      difficulty,
      questionTypeFilter,
      sourceMaterialTitle,
      questions: evaluatedQuestions,
      score: totalScore,
      totalQuestions: questions.length,
      totalMaxPoints,
      percentage,
      weakAreas,
      strengths,
      recommendedRevisionTopics: parsedDiag?.recommendedRevisionTopics || weakAreas,
      aiDiagnosticFeedback: parsedDiag?.aiDiagnosticFeedback || `Scored ${totalScore}/${totalMaxPoints} (${percentage}%). Review ${weakAreas[0] || 'core concepts'}.`,
      timeTakenSeconds,
      completedAt: new Date(),
    });

    res.status(201).json(testAttempt);
  } catch (error) {
    console.error('[TestSubmitComprehensive] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate test submission.' });
  }
});

// Standard submit test alias
router.post('/tests/submit', async (req, res) => {
  try {
    const { subject, topic, difficulty, questions, userAnswers, timeTakenSeconds } = req.body;
    let score = 0;
    const evaluated = (questions || []).map((q, idx) => {
      const selected = userAnswers[idx];
      const isCorrect = selected === q.correctAnswerIndex;
      if (isCorrect) score += 1;
      return {
        question: q.question,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
        userSelectedOption: selected,
        isCorrect,
        explanation: q.explanation,
        topicTag: q.topicTag || topic,
      };
    });

    const total = questions.length || 1;
    const percentage = Math.round((score / total) * 100);

    const missed = evaluated.filter((q) => !q.isCorrect).map((q) => q.topicTag);
    const correct = evaluated.filter((q) => q.isCorrect).map((q) => q.topicTag);

    const attempt = await TestAttempt.create({
      userId: req.user._id,
      subject,
      topic,
      difficulty: difficulty || 'Medium',
      questions: evaluated,
      score,
      totalQuestions: total,
      totalMaxPoints: total,
      percentage,
      weakAreas: Array.from(new Set(missed)),
      strengths: Array.from(new Set(correct)),
      recommendedRevisionTopics: Array.from(new Set(missed)),
      aiDiagnosticFeedback: `Good effort! Scored ${score}/${total} (${percentage}%).`,
      timeTakenSeconds: timeTakenSeconds || 0,
      completedAt: new Date(),
    });

    res.status(201).json(attempt);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to submit test.' });
  }
});

// @route   GET /api/student/tests/history
// @desc    Get practice test history for the logged-in student
router.get('/tests/history', async (req, res) => {
  try {
    const history = await TestAttempt.find({ userId: req.user._id }).sort({ completedAt: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch test history.' });
  }
});

// ==========================================
// 5. DOUBT CLARIFICATION CHAT WITH RAG CITATIONS
// ==========================================
// @route   POST /api/student/doubts
// @desc    Ask a doubt, retrieve syllabus/textbook chunks from student vault, answer with Groq & cite sources
router.post('/doubts', async (req, res) => {
  try {
    const { subject, query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Question or doubt query is required.' });
    }

    // 1. Retrieve subject-scoped RAG chunks (Isolated to student's knowledge vault)
    const relevantChunks = await retrieveRelevantChunks({
      subject: subject || 'All',
      query,
      topK: 4,
      userId: req.user._id,
    });
    const groundedContext = formatGroundedContext(relevantChunks);

    const prompt = `You are the EduCopilot Academic Assistant helping a student clarify their doubt.
Subject: ${subject || 'General Academic'}
Student Question: "${query}"

RETRIEVED COURSE MATERIAL / SYLLABUS / TEXTBOOK CONTEXT:
${groundedContext}

Instructions:
- Provide a crystal-clear, intuitive explanation grounded strictly in the course material provided.
- If the answer comes from the retrieved context, reference key terms directly.
- Include 2-3 key takeaways and 2 suggested follow-up study questions.
Return ONLY valid JSON matching this structure:
{
  "answer": "Clear markdown formatted answer with bold headings and explanations.",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2"],
  "suggestedFollowUps": ["Follow-up question 1?", "Follow-up question 2?"]
}`;

    const completion = await generateChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are an intelligent tutor grounded in course materials. Output ONLY JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    let parsed;
    try {
      parsed = JSON.parse(completion);
    } catch (err) {
      const jsonMatch = completion.match(/\{[\s\S]*\}/);
      parsed = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : {
            answer: completion,
            keyTakeaways: ['Review core principles', 'Practice problem solving'],
            suggestedFollowUps: ['Can you provide a step-by-step example?'],
          };
    }

    const citedSources = relevantChunks.map((c) => ({
      docTitle: c.docTitle,
      subject: c.subject,
      chunkExcerpt: c.chunkText.slice(0, 200) + '...',
      relevanceScore: c.relevanceScore,
    }));

    const doubtRecord = await Doubt.create({
      userId: req.user._id,
      subject: subject || 'General',
      query,
      answer: parsed.answer,
      citedSources,
      keyTakeaways: parsed.keyTakeaways || [],
      suggestedFollowUps: parsed.suggestedFollowUps || [],
    });

    res.status(201).json(doubtRecord);
  } catch (error) {
    console.error('[DoubtClarification] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to clarify doubt.' });
  }
});

// @route   GET /api/student/doubts/history
// @desc    Get doubt clarification history for the logged-in student
router.get('/doubts/history', async (req, res) => {
  try {
    const doubts = await Doubt.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(doubts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch doubt history.' });
  }
});

module.exports = router;
