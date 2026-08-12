const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const CourseDocChunk = require('./models/CourseDocChunk');
const StudyPlan = require('./models/StudyPlan');
const TestAttempt = require('./models/TestAttempt');
const LectureSchedule = require('./models/LectureSchedule');
const Material = require('./models/Material');
const { ingestDocument } = require('./services/ragService');

dotenv.config();

const seedDatabase = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/educopilot';
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('[Seeder] Connected to MongoDB');

    // 1. Create or ensure Demo Professor (Prof. Marcus Vance)
    let prof = await User.findOne({ email: 'vance@professor.edu' });
    if (!prof) {
      prof = await User.create({
        name: 'Prof. Marcus Vance',
        email: 'vance@professor.edu',
        password: 'password123',
        role: 'professor',
        gradeOrClass: 'Department of Computer Science',
        subjects: ['Computer Science', 'Distributed Systems', 'Operating Systems'],
      });
      console.log('[Seeder] Created Professor Prof. Marcus Vance');
    }

    // 2. Create or ensure Demo Student 1 (Alex Rivera)
    let student1 = await User.findOne({ email: 'alex@student.edu' });
    if (!student1) {
      student1 = await User.create({
        name: 'Alex Rivera',
        email: 'alex@student.edu',
        password: 'password123',
        role: 'student',
        gradeOrClass: 'CS-301 Section A',
        subjects: ['Computer Science', 'Distributed Systems'],
      });
      console.log('[Seeder] Created Student Alex Rivera');
    }

    // 3. Create or ensure Demo Student 2 (Sophia Chen)
    let student2 = await User.findOne({ email: 'sophia@student.edu' });
    if (!student2) {
      student2 = await User.create({
        name: 'Sophia Chen',
        email: 'sophia@student.edu',
        password: 'password123',
        role: 'student',
        gradeOrClass: 'CS-301 Section B',
        subjects: ['Computer Science', 'Mathematics'],
      });
      console.log('[Seeder] Created Student Sophia Chen');
    }

    // 4. Ingest Separate Isolated RAG Documents for each persona
    // (a) Professor Vance's Master Course Syllabus
    const professorSyllabus = `COURSE: CS-301 Distributed Systems & Operating Systems
PROFESSOR: Prof. Marcus Vance

CHAPTER 1: Fundamental Distributed Systems Theory
- The CAP Theorem: Formulated by Eric Brewer. In an asynchronous network with arbitrary partition faults (P), a distributed data system cannot simultaneously guarantee Linearizable Consistency (C) and High Availability (A).
- Linearizability provides real-time recency guarantee: once a write finishes, all subsequent reads must observe it.
- Eventual Consistency allows replicas to diverge temporarily, converging once updates propagate.

CHAPTER 2: Consensus Protocols & Fault Tolerance
- The Raft Consensus Algorithm: Designed for understandability. Elects a single leader via randomized election timeouts (150-300ms). Follower nodes increment currentTerm and cast votes via RequestVote RPCs.
- Log Invariants: If two entries in different logs have identical index and term, they store the same command and their logs are identical in all preceding entries.
- Paxos vs Raft: Paxos utilizes independent proposal sequence numbers with dual phases (Prepare-Promise, Accept-Accepted).

CHAPTER 3: Concurrency Control & Synchronization
- The 4 Coffman conditions for Deadlock: Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait.
- Deadlock Prevention eliminates one of the four conditions statically (e.g., global lock acquisition ordering).
- Optimistic Concurrency Control (OCC): Reads proceed without locks; validation phase verifies timestamp vectors before final commit.`;

    await ingestDocument({
      uploadedBy: prof._id,
      docTitle: 'CS-301 Master Course Textbook & Syllabus',
      subject: 'Computer Science',
      courseCode: 'CS-301',
      rawText: professorSyllabus,
    });
    console.log('[Seeder] Ingested isolated syllabus into Prof. Marcus Vance RAG Vault');

    // (b) Student Alex Rivera's Personal RAG Document
    const alexNotes = `ALEX RIVERA'S PERSONAL STUDY NOTES: Raft & Distributed Invariants
- Leader election randomized interval: choose [150ms, 300ms] to avoid split votes.
- Heartbeat interval: Broadcast AppendEntries empty heartbeat every 50ms.
- Log Matching Property: If two logs contain an entry with the same index and term, then the logs are identical in all entries up through the given index.
- Election Safety: At most one leader can be elected in a given term.`;

    await ingestDocument({
      uploadedBy: student1._id,
      docTitle: "Alex's Personal Raft Study Notes & Cheat Sheet",
      subject: 'Computer Science',
      courseCode: 'CS-301',
      rawText: alexNotes,
    });
    console.log('[Seeder] Ingested isolated study notes into Alex Rivera RAG Vault');

    // (c) Student Sophia Chen's Personal RAG Document (Completely separate content!)
    const sophiaNotes = `SOPHIA CHEN'S PERSONAL STUDY NOTES: Discrete Math & Graph Algorithms
- Dijkstra Algorithm: Finds shortest paths from single source with non-negative edge weights using min-priority queue O((V + E) log V).
- Bellman-Ford: Detects negative weight cycles in O(V * E) time complexity.
- Minimum Spanning Tree: Kruskal algorithm uses Union-Find disjoint sets O(E log V); Prim algorithm grows spanning tree from starting vertex.
- Bipartite Graph Verification: Graph is bipartite if and only if it contains no odd-length cycles.`;

    await ingestDocument({
      uploadedBy: student2._id,
      docTitle: "Sophia's Graph Algorithms & Discrete Math Notes",
      subject: 'Computer Science',
      courseCode: 'CS-202',
      rawText: sophiaNotes,
    });
    console.log('[Seeder] Ingested isolated study notes into Sophia Chen RAG Vault');

    // 5. Seed an initial study plan for Alex Rivera (Isolated)
    const existingAlexPlan = await StudyPlan.findOne({ userId: student1._id });
    if (!existingAlexPlan) {
      await StudyPlan.create({
        userId: student1._id,
        subject: 'Computer Science',
        topic: 'Raft Consensus Protocol & Invariants',
        targetExamDate: '2026-09-01',
        syllabusRef: 'Chapter 2: Consensus Protocols',
        durationDays: 5,
        planDays: [
          {
            day: 1,
            title: 'Raft Leader Election & Randomized Timers',
            focus: 'Understand split-brain prevention and RequestVote RPC mechanics',
            tasks: ['Review Chapter 2 notes', 'Trace 3-node partition election'],
            completed: true,
          },
          {
            day: 2,
            title: 'Log Replication & AppendEntries RPC',
            focus: 'Master commitIndex and matchIndex tracking',
            tasks: ['Draw log alignment diagram', 'Solve 2 practice questions'],
            completed: false,
          },
          {
            day: 3,
            title: 'Safety Invariants & Leader Completeness',
            focus: 'Verify why leader never overwrites its own log entries',
            tasks: ['Analyze edge cases', 'Review textbook proofs'],
            completed: false,
          },
        ],
        topicSummary: 'Master the core mechanics of Raft leader election, randomized timeouts, and log matching safety.',
        revisionNotes: '### Key Raft Rules\n- Election Timeout: 150-300ms randomized.\n- Quorum: Majority $N/2 + 1$.\n- Safety: Candidates must have up-to-date logs to be elected.',
        progressPercent: 33,
      });
      console.log('[Seeder] Created initial isolated Study Plan for Alex Rivera');
    }

    // 6. Seed an initial lecture schedule for Prof. Marcus Vance
    const existingSchedule = await LectureSchedule.findOne({ professorId: prof._id });
    if (!existingSchedule) {
      await LectureSchedule.create({
        professorId: prof._id,
        courseCode: 'CS-301',
        subject: 'Computer Science',
        title: 'Lecture 1: CAP Theorem & Consistency Bounds',
        date: '2026-08-15',
        durationMinutes: 75,
        topics: ['CAP Theorem', 'Linearizability', 'Eventual Consistency'],
        learningObjectives: ['Prove CAP trade-offs', 'Evaluate database engines (Spanner vs Cassandra)'],
        aiSequencingNotes: 'Foundational baseline before advancing to active consensus protocols.',
      });
      console.log('[Seeder] Created initial Lecture Schedule for Prof. Marcus Vance');
    }

    console.log('[Seeder] Database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Seeder] Error seeding database:', error.message);
    process.exit(0); // Exit cleanly even if local mongo is offline
  }
};

seedDatabase();
