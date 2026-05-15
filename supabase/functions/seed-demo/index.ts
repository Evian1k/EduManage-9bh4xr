import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_OWNER_EMAIL = 'owner@edumanage.demo';
const DEMO_ADMIN_EMAIL = 'admin@greenfield.demo';
const DEMO_TEACHER_EMAIL = 'teacher@greenfield.demo';
const DEMO_STUDENT_EMAIL = 'student@greenfield.demo';
const DEMO_PASSWORD = 'Demo123!';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results: Record<string, string> = {};

    // Helper: create or get user
    async function ensureUser(email: string, username: string): Promise<string> {
      // Check if user exists in user_profiles
      const { data: existing } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existing?.id) return existing.id;

      // Create via auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { username },
      });

      if (authError) {
        // Try to get existing auth user
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const found = listData?.users?.find((u) => u.email === email);
        if (found) return found.id;
        throw new Error(`Failed to create user ${email}: ${authError.message}`);
      }

      const userId = authData.user.id;

      // Ensure user_profile exists
      await supabaseAdmin.from('user_profiles').upsert({
        id: userId,
        email,
        username,
      });

      return userId;
    }

    // 1. Create Platform Owner
    const ownerId = await ensureUser(DEMO_OWNER_EMAIL, 'Platform Owner');
    results.owner = ownerId;

    // Make platform admin
    await supabaseAdmin.from('platform_admins').upsert({ user_id: ownerId });

    // 2. Create School Admin
    const adminId = await ensureUser(DEMO_ADMIN_EMAIL, 'Sarah Johnson');
    results.admin = adminId;

    await supabaseAdmin.from('school_users').upsert({
      user_id: adminId,
      school_id: DEMO_SCHOOL_ID,
      role: 'admin',
      employee_id: 'EMP001',
      department: 'Administration',
      is_active: true,
    }, { onConflict: 'user_id,school_id' });

    // 3. Create Demo Teacher
    const teacherId = await ensureUser(DEMO_TEACHER_EMAIL, 'Mr. David Chen');
    results.teacher = teacherId;

    const { data: teacherSchoolUser } = await supabaseAdmin.from('school_users').upsert({
      user_id: teacherId,
      school_id: DEMO_SCHOOL_ID,
      role: 'teacher',
      employee_id: 'TCH001',
      department: 'Science',
      is_active: true,
    }, { onConflict: 'user_id,school_id' }).select().single();

    // 4. Create Demo Student user
    const studentUserId = await ensureUser(DEMO_STUDENT_EMAIL, 'Alex Smith');
    results.studentUser = studentUserId;

    // 5. Seed subjects
    const subjectData = [
      { name: 'Mathematics', code: 'MATH101', description: 'Core Mathematics', credits: 4 },
      { name: 'English Language', code: 'ENG101', description: 'English & Literature', credits: 3 },
      { name: 'Physics', code: 'PHY101', description: 'Introductory Physics', credits: 4 },
      { name: 'Chemistry', code: 'CHEM101', description: 'General Chemistry', credits: 3 },
      { name: 'Biology', code: 'BIO101', description: 'Life Sciences', credits: 3 },
      { name: 'Computer Science', code: 'CS101', description: 'Programming & Tech', credits: 3 },
      { name: 'History', code: 'HIST101', description: 'World History', credits: 2 },
      { name: 'Geography', code: 'GEO101', description: 'Physical Geography', credits: 2 },
    ];

    const { data: subjects } = await supabaseAdmin
      .from('subjects')
      .upsert(subjectData.map((s) => ({ ...s, school_id: DEMO_SCHOOL_ID })), { onConflict: 'school_id,code' })
      .select();

    results.subjects = `${subjects?.length || 0} subjects`;

    const mathSubject = subjects?.find((s) => s.code === 'MATH101');
    const physSubject = subjects?.find((s) => s.code === 'PHY101');
    const engSubject = subjects?.find((s) => s.code === 'ENG101');

    // 6. Seed classes
    const classData = [
      { name: 'Grade 10A', grade_level: '10', section: 'A', academic_year: '2025/2026', capacity: 35, room_number: '101' },
      { name: 'Grade 10B', grade_level: '10', section: 'B', academic_year: '2025/2026', capacity: 35, room_number: '102' },
      { name: 'Grade 11A', grade_level: '11', section: 'A', academic_year: '2025/2026', capacity: 30, room_number: '201' },
      { name: 'Grade 11B', grade_level: '11', section: 'B', academic_year: '2025/2026', capacity: 30, room_number: '202' },
      { name: 'Grade 12A', grade_level: '12', section: 'A', academic_year: '2025/2026', capacity: 28, room_number: '301' },
    ];

    const { data: classes } = await supabaseAdmin
      .from('classes')
      .upsert(classData.map((c) => ({ ...c, school_id: DEMO_SCHOOL_ID })), { onConflict: 'school_id,name' })
      .select();

    results.classes = `${classes?.length || 0} classes`;
    const class10A = classes?.find((c) => c.name === 'Grade 10A');
    const class11A = classes?.find((c) => c.name === 'Grade 11A');

    // 7. Link teacher to classes
    if (class10A && mathSubject && teacherSchoolUser) {
      await supabaseAdmin.from('class_subjects').upsert([
        { class_id: class10A.id, subject_id: mathSubject.id, teacher_id: teacherSchoolUser.id, school_id: DEMO_SCHOOL_ID },
        { class_id: class10A.id, subject_id: physSubject?.id, teacher_id: teacherSchoolUser.id, school_id: DEMO_SCHOOL_ID },
      ].filter((r) => r.subject_id), { onConflict: 'class_id,subject_id' });
    }

    // 8. Seed students
    const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Isabella', 'Mason', 'Sophia', 'James',
      'Mia', 'Oliver', 'Charlotte', 'Elijah', 'Amelia', 'Benjamin', 'Harper', 'Lucas', 'Evelyn', 'Henry'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore',
      'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Young', 'Robinson'];

    const studentRows = firstNames.map((fn, i) => ({
      school_id: DEMO_SCHOOL_ID,
      class_id: i < 10 ? class10A?.id : class11A?.id,
      admission_number: `GFA${String(2024001 + i).slice(-4)}`,
      first_name: fn,
      last_name: lastNames[i],
      gender: i % 2 === 0 ? 'female' : 'male',
      email: `${fn.toLowerCase()}.${lastNames[i].toLowerCase()}@greenfield.demo`,
      admission_date: '2024-09-01',
      status: 'active',
      parent_name: `Mr. ${lastNames[i]}`,
      parent_phone: `+1-555-${String(1000 + i).padStart(4, '0')}`,
    }));

    // Link first student to demo student user
    if (class10A) {
      studentRows[0].user_id = studentUserId;
    }

    const { data: students } = await supabaseAdmin
      .from('students')
      .upsert(studentRows, { onConflict: 'school_id,admission_number' })
      .select();

    results.students = `${students?.length || 0} students`;

    // 9. Link student user to school
    await supabaseAdmin.from('school_users').upsert({
      user_id: studentUserId,
      school_id: DEMO_SCHOOL_ID,
      role: 'student',
      is_active: true,
    }, { onConflict: 'user_id,school_id' });

    // 10. Seed assignments
    if (class10A && mathSubject && teacherSchoolUser) {
      const assignmentRows = [
        {
          school_id: DEMO_SCHOOL_ID, class_id: class10A.id, subject_id: mathSubject.id,
          teacher_id: teacherSchoolUser.id, title: 'Quadratic Equations Practice',
          description: 'Solve problems 1-20 from Chapter 5. Show all working.', 
          due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
          max_score: 100, assignment_type: 'homework', is_published: true,
        },
        {
          school_id: DEMO_SCHOOL_ID, class_id: class10A.id, subject_id: physSubject?.id || mathSubject.id,
          teacher_id: teacherSchoolUser.id, title: 'Newton\'s Laws Lab Report',
          description: 'Write a lab report on the friction experiment conducted in class.',
          due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
          max_score: 50, assignment_type: 'project', is_published: true,
        },
        {
          school_id: DEMO_SCHOOL_ID, class_id: class10A.id, subject_id: mathSubject.id,
          teacher_id: teacherSchoolUser.id, title: 'Mid-Term Exam Revision',
          description: 'Revision questions covering chapters 1-8.',
          due_date: new Date(Date.now() + 3 * 86400000).toISOString(),
          max_score: 200, assignment_type: 'exam', is_published: true,
        },
      ].filter((a) => a.subject_id);

      await supabaseAdmin.from('assignments').insert(assignmentRows).select();
    }

    // 11. Seed announcements
    await supabaseAdmin.from('announcements').upsert([
      {
        school_id: DEMO_SCHOOL_ID, author_id: adminId,
        title: 'Welcome to EduManage!',
        content: 'We are excited to introduce our new school management system. All student records, grades, and attendance are now digital. Please explore the platform and contact support if you need help.',
        target_roles: ['all'], is_pinned: true,
      },
      {
        school_id: DEMO_SCHOOL_ID, author_id: adminId,
        title: 'Mid-Term Exams Schedule',
        content: 'Mid-term examinations will be held from May 20-24, 2026. Timetables have been uploaded to the portal. Students should report 30 minutes before their exam time.',
        target_roles: ['student', 'teacher'],
      },
      {
        school_id: DEMO_SCHOOL_ID, author_id: adminId,
        title: 'Parent-Teacher Conference',
        content: 'Annual Parent-Teacher conference scheduled for June 5, 2026. All teachers must prepare student progress reports by May 30.',
        target_roles: ['teacher', 'admin'],
      },
    ], { onConflict: 'id' });

    // 12. Seed grades for first few students
    if (students && class10A && mathSubject) {
      const gradeRows = students.slice(0, 10).map((student, i) => ({
        school_id: DEMO_SCHOOL_ID,
        student_id: student.id,
        subject_id: mathSubject.id,
        class_id: class10A.id,
        term: 'Term 1',
        academic_year: '2025/2026',
        score: 60 + Math.floor(Math.random() * 40),
        grade_letter: ['A', 'A', 'B+', 'B', 'B', 'C+', 'C', 'B+', 'A-', 'B'][i],
        recorded_by: teacherSchoolUser?.id,
      }));
      await supabaseAdmin.from('grades').insert(gradeRows).select();
    }

    // 13. Seed AI usage logs for analytics
    await supabaseAdmin.from('ai_usage_logs').insert([
      { school_id: DEMO_SCHOOL_ID, user_id: adminId, feature: 'assignment_generation', tokens_used: 450 },
      { school_id: DEMO_SCHOOL_ID, user_id: teacherId, feature: 'auto_grading', tokens_used: 320 },
      { school_id: DEMO_SCHOOL_ID, user_id: teacherId, feature: 'chat', tokens_used: 180 },
      { school_id: DEMO_SCHOOL_ID, user_id: adminId, feature: 'performance_insights', tokens_used: 550 },
    ]);

    // Update school AI usage count
    await supabaseAdmin
      .from('schools')
      .update({ ai_usage_count: 15 })
      .eq('id', DEMO_SCHOOL_ID);

    return new Response(JSON.stringify({
      success: true,
      message: 'Demo data seeded successfully',
      credentials: {
        platformOwner: { email: DEMO_OWNER_EMAIL, password: DEMO_PASSWORD },
        schoolAdmin: { email: DEMO_ADMIN_EMAIL, password: DEMO_PASSWORD },
        teacher: { email: DEMO_TEACHER_EMAIL, password: DEMO_PASSWORD },
        student: { email: DEMO_STUDENT_EMAIL, password: DEMO_PASSWORD },
      },
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Demo seed error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
