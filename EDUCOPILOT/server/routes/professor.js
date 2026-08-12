const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/authMiddleware');
const LectureSchedule = require('../models/LectureSchedule');
const Material = require('../models/Material');
const GradedSubmission = require('../models/GradedSubmission');
const CourseDocChunk = require('../models/CourseDocChunk');
const { generateChatCompletion } = require('../services/groqService');
const { retrieveRelevantChunks, formatGroundedContext, ingestDocument } = require('../services/ragService');
const { extractTextFromFile } = require('../services/fileParserService');

// Multer memory storage for multi-modal uploads (PDF, Excel, Images, Text)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
});

// Protect all professor routes
router.use(protect);
router.use(authorize('professor'));

// ==========================================
// 1. PROFESSOR DASHBOARD
// ==========================================
router.get('/dashboard', async (req, res) => {
  try {
    const profId = req.user._id;

    const [schedules, materials, gradings, docCount] = await Promise.all([
      LectureSchedule.find({ professorId: profId }).sort({ date: 1 }).limit(5),
      Material.find({ professorId: profId }).sort({ createdAt: -1 }).limit(5),
      GradedSubmission.find({ professorId: profId }).sort({ gradedAt: -1 }).limit(5),
      CourseDocChunk.countDocuments({ uploadedBy: profId }),
    ]);

    const totalSchedules = await LectureSchedule.countDocuments({ professorId: profId });
    const totalMaterials = await Material.countDocuments({ professorId: profId });
    const totalGradings = await GradedSubmission.countDocuments({ professorId: profId });

    res.json({
      stats: {
        totalSchedules,
        totalMaterials,
        totalGradings,
        indexedDocsChunks: docCount,
      },
      upcomingLectures: schedules,
      recentMaterials: materials,
      recentGradings: gradings,
    });
  } catch (error) {
    console.error('[ProfessorDashboard] Error:', error);
    res.status(500).json({ error: 'Failed to load professor dashboard.' });
  }
});

// ==========================================
// 2. LECTURE SCHEDULING (MULTI-MODAL IMPORT + STAGING + EDITING)
// ==========================================
// @route   POST /api/professor/schedules/import
// @desc    Import schedule from PDF, Excel/CSV, Timetable Image, or Raw text -> extracts structured lectures for staging
router.post('/schedules/import', upload.single('file'), async (req, res) => {
  try {
    const { rawText, defaultSubject = 'Computer Science', defaultCourseCode = 'CS-301' } = req.body;
    let extractedText = rawText || '';

    if (req.file) {
      extractedText = await extractTextFromFile({
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      });
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return res.status(400).json({
        error: 'Please upload a PDF/Excel/Image timetable file or paste text content to import.',
      });
    }

    const prompt = `You are an AI Academic Timetable & Syllabus Extraction Engine.
Extract all lecture sessions, classes, topics, dates, times, durations, and sections from the provided document.

DOCUMENT CONTENT:
"""
${extractedText.slice(0, 8000)}
"""

Instructions:
Extract each lecture row accurately. If date or time is not explicitly stated, generate a reasonable sequential date starting from upcoming Monday and standard 60-min time slots.
Return ONLY valid JSON matching this exact structure:
{
  "extractedLectures": [
    {
      "courseCode": "${defaultCourseCode}",
      "subject": "${defaultSubject}",
      "title": "Topic or Lecture Title",
      "date": "YYYY-MM-DD",
      "time": "10:00 AM",
      "durationMinutes": 60,
      "classOrSection": "Section A",
      "topics": ["Subtopic 1", "Subtopic 2"],
      "learningObjectives": ["Learning Objective 1"],
      "aiSequencingNotes": "Sequential placement rationale"
    }
  ]
}`;

    const completion = await generateChatCompletion({
      messages: [
        { role: 'system', content: 'You are a timetable extraction engine. Output strictly JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    let parsed;
    try {
      parsed = JSON.parse(completion);
    } catch (err) {
      const match = completion.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { extractedLectures: [] };
    }

    const lectures = parsed?.extractedLectures || [];
    res.json({
      totalExtracted: lectures.length,
      extractedLectures: lectures,
      sourceExcerpt: extractedText.slice(0, 300) + '...',
    });
  } catch (error) {
    console.error('[ScheduleImport] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to import timetable.' });
  }
});

// @route   POST /api/professor/schedules/batch
// @desc    Batch save edited extracted lectures to calendar
router.post('/schedules/batch', async (req, res) => {
  try {
    const { lectures } = req.body;
    if (!lectures || !Array.isArray(lectures) || lectures.length === 0) {
      return res.status(400).json({ error: 'No lectures provided to save.' });
    }

    const docsToInsert = lectures.map((lec) => ({
      professorId: req.user._id,
      courseCode: lec.courseCode || 'CS-301',
      subject: lec.subject || 'Computer Science',
      title: lec.title || 'Untitled Lecture',
      date: lec.date || new Date().toISOString().split('T')[0],
      time: lec.time || '10:00 AM',
      classOrSection: lec.classOrSection || 'Section A',
      durationMinutes: Number(lec.durationMinutes) || 60,
      topics: Array.isArray(lec.topics) ? lec.topics : [lec.topics || 'General'],
      learningObjectives: Array.isArray(lec.learningObjectives) ? lec.learningObjectives : [],
      aiSequencingNotes: lec.aiSequencingNotes || '',
      status: 'Scheduled',
    }));

    const inserted = await LectureSchedule.insertMany(docsToInsert);
    res.status(201).json({
      message: `Successfully saved ${inserted.length} lectures to your schedule.`,
      schedules: inserted,
    });
  } catch (error) {
    console.error('[ScheduleBatchSave] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to save lectures to schedule.' });
  }
});

// @route   POST /api/professor/schedules/suggest
// @desc    Generate AI-assisted topic sequencing and prerequisites based on syllabus
router.post('/schedules/suggest', async (req, res) => {
  try {
    const { subject, courseCode, topicsList, targetLecturesCount = 5 } = req.body;

    if (!subject || !topicsList) {
      return res.status(400).json({ error: 'Subject and topic list are required.' });
    }

    const relevantChunks = await retrieveRelevantChunks({
      subject,
      query: `${topicsList} syllabus lecture sequencing curriculum`,
      topK: 3,
      userId: req.user._id,
    });
    const groundedContext = formatGroundedContext(relevantChunks);

    const prompt = `You are a Senior Academic Curriculum Specialist helping a Professor plan and sequence their course lectures.
Subject: ${subject} (${courseCode || 'Course'})
Raw Topic List / Syllabus: ${topicsList}
Target Lectures: ${targetLecturesCount}

COURSE SYLLABUS REFERENCE:
${groundedContext}

Instructions:
Optimize the pedagogical sequence of these topics so concepts build logically from prerequisites to advanced applications.
Return ONLY valid JSON matching this structure:
{
  "sequencedLectures": [
    {
      "lectureNumber": 1,
      "title": "Lecture Title",
      "durationMinutes": 60,
      "time": "10:00 AM",
      "classOrSection": "Section A",
      "topics": ["Topic A", "Topic B"],
      "learningObjectives": ["Objective 1", "Objective 2"],
      "prerequisites": ["Prereq 1"],
      "aiSequencingNotes": "Why this topic belongs here in the pedagogical order"
    }
  ]
}`;

    const completion = await generateChatCompletion({
      messages: [
        { role: 'system', content: 'You are an academic curriculum director. Output strictly JSON.' },
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

    res.json(parsed || { sequencedLectures: [] });
  } catch (error) {
    console.error('[ScheduleSuggest] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to suggest sequencing.' });
  }
});

// @route   POST /api/professor/schedules
// @desc    Save a single scheduled lecture
router.post('/schedules', async (req, res) => {
  try {
    const {
      courseCode,
      subject,
      title,
      date,
      time,
      classOrSection,
      durationMinutes,
      topics,
      learningObjectives,
      aiSequencingNotes,
      prerequisites,
    } = req.body;

    const schedule = await LectureSchedule.create({
      professorId: req.user._id,
      courseCode: courseCode || 'CS-301',
      subject: subject || 'Computer Science',
      title,
      date,
      time: time || '10:00 AM',
      classOrSection: classOrSection || 'Section A',
      durationMinutes: durationMinutes || 60,
      topics: Array.isArray(topics) ? topics : [topics],
      learningObjectives: Array.isArray(learningObjectives) ? learningObjectives : [],
      aiSequencingNotes: aiSequencingNotes || '',
      prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
    });

    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to save lecture schedule.' });
  }
});

// @route   GET /api/professor/schedules
// @desc    Get all scheduled lectures for this professor
router.get('/schedules', async (req, res) => {
  try {
    const schedules = await LectureSchedule.find({ professorId: req.user._id }).sort({ date: 1 });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schedules.' });
  }
});

// @route   DELETE /api/professor/schedules/:id
// @desc    Delete a scheduled lecture
router.delete('/schedules/:id', async (req, res) => {
  try {
    const deleted = await LectureSchedule.findOneAndDelete({
      _id: req.params.id,
      professorId: req.user._id,
    });
    if (!deleted) return res.status(404).json({ error: 'Schedule not found or access denied.' });
    res.json({ message: 'Schedule removed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete schedule.' });
  }
});

// ==========================================
// 3. AI MATERIAL PREPARATION (SLIDES, NOTES, ASSIGNMENTS, PRACTICE QUESTIONS)
// ==========================================
// @route   POST /api/professor/materials/generate-with-upload
// @desc    Upload direct document OR use RAG vault to synthesize grounded slides, notes, assignments, or practice questions
router.post('/materials/generate-with-upload', upload.single('file'), async (req, res) => {
  try {
    const { subject, topic, type, syllabusRef = '', rawText = '' } = req.body;

    if (!subject || !topic || !type) {
      return res.status(400).json({ error: 'Subject, topic, and material type are required.' });
    }

    let uploadedDocText = rawText || '';

    // If user provided a new file right in the Material Prep form, ingest it into RAG
    if (req.file) {
      uploadedDocText = await extractTextFromFile({
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      });

      if (uploadedDocText && uploadedDocText.trim().length > 20) {
        await ingestDocument({
          uploadedBy: req.user._id,
          docTitle: req.file.originalname.replace(/\.[^/.]+$/, ''),
          subject,
          rawText: uploadedDocText,
        });
      }
    }

    // Retrieve relevant chunks from professor's vault
    const relevantChunks = await retrieveRelevantChunks({
      subject,
      query: `${topic} ${syllabusRef} ${uploadedDocText.slice(0, 200)}`,
      topK: 4,
      userId: req.user._id,
    });

    let groundedContext = formatGroundedContext(relevantChunks);
    if (uploadedDocText && uploadedDocText.trim().length > 20) {
      groundedContext = `[DIRECTLY ATTACHED STUDY MATERIAL]\n${uploadedDocText.slice(0, 4000)}\n\n` + groundedContext;
    }

    let systemPrompt = 'You are an academic course content generator for University Professors. Ground all content strictly in the course materials provided. Output strictly JSON.';
    let userPrompt = '';

    if (type === 'slides') {
      userPrompt = `Create an in-depth 5-slide lecture outline on "${topic}" for ${subject}.
COURSE REFERENCE:
${groundedContext}

Return JSON matching:
{
  "title": "Presentation Title",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide Title",
      "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"],
      "visualSuggestion": "Diagram or visual schematic to display",
      "speakerNotes": "Guidance for the professor on what to say"
    }
  ]
}`;
    } else if (type === 'notes') {
      userPrompt = `Draft comprehensive, structured lecture notes on "${topic}" for ${subject}.
COURSE REFERENCE:
${groundedContext}

Return JSON matching:
{
  "title": "Comprehensive Lecture Notes: ${topic}",
  "lectureNotes": "Markdown formatted lecture notes with headings, bold definitions, key formulas, theorems, and practical code/architecture examples."
}`;
    } else if (type === 'assignment') {
      userPrompt = `Create a rigorous academic assignment on "${topic}" for ${subject}.
COURSE REFERENCE:
${groundedContext}

Return JSON matching:
{
  "title": "Assignment: ${topic}",
  "instructions": "Submission instructions and guidelines",
  "assignments": [
    {
      "question": "Question text here?",
      "questionType": "Descriptive",
      "rubric": "Expected key points for full credit",
      "points": 25
    }
  ]
}`;
    } else {
      // practice_questions
      userPrompt = `Create formative practice questions bank with solutions on "${topic}" for ${subject}.
COURSE REFERENCE:
${groundedContext}

Return JSON matching:
{
  "title": "Practice Question Bank: ${topic}",
  "practiceQuestions": [
    {
      "question": "Practice question text?",
      "questionType": "ShortAnswer",
      "modelAnswer": "Comprehensive model solution explaining key steps",
      "difficulty": "Medium",
      "points": 10
    }
  ]
}`;
    }

    const completion = await generateChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    let parsed;
    try {
      parsed = JSON.parse(completion);
    } catch (err) {
      const jsonMatch = completion.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { content: completion };
    }

    const materialDoc = await Material.create({
      professorId: req.user._id,
      subject,
      topic,
      type,
      title: parsed.title || `${type.toUpperCase()}: ${topic}`,
      content: parsed,
      syllabusRef,
    });

    res.status(201).json(materialDoc);
  } catch (error) {
    console.error('[MaterialGenerate] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate material.' });
  }
});

// @route   GET /api/professor/materials
// @desc    Get all materials created by this professor
router.get('/materials', async (req, res) => {
  try {
    const materials = await Material.find({ professorId: req.user._id }).sort({ createdAt: -1 });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch materials.' });
  }
});

// ==========================================
// 4. ASSESSMENT & AUTO-GRADING (MULTI-FORMAT, OBJECTIVE + SUBJECTIVE, OVERRIDE)
// ==========================================
// @route   POST /api/professor/grading/extract-and-grade
// @desc    Evaluate student submission (supports Question Paper + Answer Sheet upload, OCR, mixed question types)
router.post(
  '/grading/extract-and-grade',
  upload.fields([
    { name: 'questionPaper', maxCount: 1 },
    { name: 'answerSheet', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        studentName,
        subject,
        assignmentTitle,
        questionPaperText = '',
        submissionText = '',
        rubricCriteria = '',
      } = req.body;

      if (!studentName || !assignmentTitle) {
        return res.status(400).json({
          error: 'Student name and assignment title are required.',
        });
      }

      let finalQPText = questionPaperText || '';
      let finalAnswerText = submissionText || '';
      let extractionMethod = 'OnlineSubmission';

      // Extract Question Paper file if provided
      if (req.files?.questionPaper?.[0]) {
        const qpFile = req.files.questionPaper[0];
        finalQPText = await extractTextFromFile({
          fileBuffer: qpFile.buffer,
          originalName: qpFile.originalname,
          mimeType: qpFile.mimetype,
        });
      }

      // Extract Answer Sheet file if provided
      if (req.files?.answerSheet?.[0]) {
        const ansFile = req.files.answerSheet[0];
        extractionMethod = ansFile.mimetype.includes('image')
          ? 'UploadedSheetOCR'
          : 'PDFExtract';
        finalAnswerText = await extractTextFromFile({
          fileBuffer: ansFile.buffer,
          originalName: ansFile.originalname,
          mimeType: ansFile.mimetype,
        });
      }

      if (!finalAnswerText || finalAnswerText.trim().length < 5) {
        return res.status(400).json({
          error: 'Student answer content is empty. Please upload an answer sheet or paste answer text.',
        });
      }

      // Retrieve course reference benchmarks from professor vault
      const relevantChunks = await retrieveRelevantChunks({
        subject: subject || 'General',
        query: `${assignmentTitle} ${finalQPText.slice(0, 200)} ${finalAnswerText.slice(0, 200)}`,
        topK: 3,
        userId: req.user._id,
      });
      const groundedContext = formatGroundedContext(relevantChunks);

      const prompt = `You are an Academic Auto-Grading & Assessment AI.
Evaluate this student's submission against the question paper and grading rubric.

QUESTION PAPER / RUBRIC BENCHMARK:
${finalQPText ? `QUESTION PAPER:\n"""${finalQPText.slice(0, 3000)}"""\n` : ''}
${rubricCriteria ? `RUBRIC GUIDELINES:\n${rubricCriteria}\n` : ''}
COURSE REFERENCE BENCHMARK:
${groundedContext}

STUDENT ANSWER SHEET / SUBMISSION:
"""
${finalAnswerText.slice(0, 5000)}
"""

Instructions:
1. Handle mixed question types:
   - MCQ / True-False / Fill-in-the-blank: evaluate with exact deterministic correctness.
   - Short-Answer / Descriptive: evaluate conceptual depth, reasoning, and technical terms against reference answers.
2. For each question, extract/identify the question number, question type, student's answer, reference answer, max points, and awarded points.
3. Formulate individualized, constructive feedback tailored specifically to ${studentName}'s actual answers (never generic).
4. Provide list of key strengths and areas for growth.

Return ONLY valid JSON matching this exact structure:
{
  "totalScore": 85,
  "maxScore": 100,
  "percentage": 85,
  "overallGrade": "B+",
  "individualizedFeedback": "Constructive 3-4 sentence paragraph addressing ${studentName} directly.",
  "keyStrengths": ["Strength 1", "Strength 2"],
  "areasForGrowth": ["Improvement tip 1", "Improvement tip 2"],
  "gradedItems": [
    {
      "questionNumber": 1,
      "questionType": "MCQ",
      "question": "Question text",
      "studentAnswer": "Student's answer",
      "referenceAnswer": "Expected correct answer",
      "maxPoints": 20,
      "awardedPoints": 20,
      "rubricCriterion": "Objective accuracy",
      "evaluatorNotes": "Correct option selected.",
      "improvementTip": ""
    },
    {
      "questionNumber": 2,
      "questionType": "Descriptive",
      "question": "Question text",
      "studentAnswer": "Student's explanation",
      "referenceAnswer": "Key theoretical points expected",
      "maxPoints": 30,
      "awardedPoints": 25,
      "rubricCriterion": "Conceptual clarity & edge cases",
      "evaluatorNotes": "Well argued; minor omission on boundary conditions.",
      "improvementTip": "Include formal proofs for edge cases."
    }
  ]
}`;

      const completion = await generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are an objective and constructive university grading assistant. Output strictly JSON.' },
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

      const gradedItemsWithOriginal = (parsed?.gradedItems || []).map((item) => ({
        ...item,
        originalAwardedPoints: item.awardedPoints,
        isOverridden: false,
      }));

      const gradingRecord = await GradedSubmission.create({
        professorId: req.user._id,
        studentName,
        subject: subject || 'Academic Course',
        assignmentTitle,
        questionPaperText: finalQPText,
        submissionText: finalAnswerText,
        sourceExtractionMethod: extractionMethod,
        gradedItems: gradedItemsWithOriginal,
        totalScore: parsed?.totalScore || 0,
        maxScore: parsed?.maxScore || 100,
        percentage: parsed?.percentage || 0,
        overallGrade: parsed?.overallGrade || 'B',
        individualizedFeedback: parsed?.individualizedFeedback || 'Submission graded successfully.',
        keyStrengths: parsed?.keyStrengths || [],
        areasForGrowth: parsed?.areasForGrowth || [],
        gradedAt: new Date(),
      });

      res.status(201).json(gradingRecord);
    } catch (error) {
      console.error('[GradingExtractAndGrade] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to evaluate submission.' });
    }
  }
);

// @route   PUT /api/professor/grading/:id/override
// @desc    Professor manually reviews and overrides AI-generated marks/feedback
router.put('/grading/:id/override', async (req, res) => {
  try {
    const { gradedItems, individualizedFeedback, overallGrade } = req.body;
    const submission = await GradedSubmission.findOne({
      _id: req.params.id,
      professorId: req.user._id,
    });

    if (!submission) {
      return res.status(404).json({ error: 'Graded submission not found or access denied.' });
    }

    if (gradedItems && Array.isArray(gradedItems)) {
      submission.gradedItems = gradedItems.map((item) => ({
        ...item,
        isOverridden: item.awardedPoints !== item.originalAwardedPoints,
      }));

      // Recalculate total score & percentage
      const totalScore = submission.gradedItems.reduce((acc, curr) => acc + Number(curr.awardedPoints || 0), 0);
      const maxScore = submission.gradedItems.reduce((acc, curr) => acc + Number(curr.maxPoints || 0), 0) || submission.maxScore || 100;
      submission.totalScore = totalScore;
      submission.maxScore = maxScore;
      submission.percentage = Math.round((totalScore / maxScore) * 100);
    }

    if (individualizedFeedback) {
      submission.individualizedFeedback = individualizedFeedback;
    }

    if (overallGrade) {
      submission.overallGrade = overallGrade;
    } else {
      const pct = submission.percentage;
      submission.overallGrade = pct >= 90 ? 'A' : pct >= 80 ? 'B+' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'D';
    }

    await submission.save();
    res.json(submission);
  } catch (error) {
    console.error('[GradingOverride] Error:', error);
    res.status(500).json({ error: 'Failed to update grading overrides.' });
  }
});

// @route   GET /api/professor/grading/history
// @desc    Get all graded submissions evaluated by this professor
router.get('/grading/history', async (req, res) => {
  try {
    const history = await GradedSubmission.find({ professorId: req.user._id }).sort({ gradedAt: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch grading history.' });
  }
});

module.exports = router;
