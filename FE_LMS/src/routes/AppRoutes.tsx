import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import {
  DashboardPage,
  StudentDashboardPage,
  TeacherDashboardPage,
  LandingPage,
  NotFoundPage,
  EmailVerifyPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  LoginPage,
  RegisterPage,
  CourseManagementPage,
  MyCoursesPage,
  MyCoursesV2Page,
  CourseDetailPage,
  ListAllLessonsPage,
  AboutUsPage,
  FAQPage,
  AssignmentPage,
  QuizManagementPage,
  QuizCreatePage,
  CourseQuizzesPage,
  QuizQuestionsPage,
  QuizAttemptDetailPage,
  TakeQuizPage,
  FeedbackPage,
  FeedbackListPage,
  EnrollmentsListPage,
  CurriculumPage,
  UserManagementPage,
  UserBioPage,
  AttendancePage,
  MyEnrollmentsPage,
  ForumPage,
  ForumListPage,
  ForumDetailPage,
  ForumPostDetailPage,
  OnboardingPage,
  DeletedCoursesPage,
  QuizAttemptsPage,
  GradeAttemptPage,
  CreateSemesterPage,
  ListSemestersPage,
  BlogPage,
  BlogDetailPage,
  JoinCoursePage,
  ApprovedCoursesPage,
} from "../pages";

import EmailVerificationPage from "../pages/auth/EmailVerificationPage";
import LessonMaterialDetailPage from "../pages/lessons/LessonMaterialDetailPage";
import AssignmentDetailPage from "../pages/assignments/AssignmentDetailPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import Profile from "../pages/user/profile";
import Calendar from "../components/calendar/Calendar";
import Chat from "../pages/Chat/Chat";
import FloatingChatContainer from "../components/FloatingChat/FloatingChatContainer";

function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* Onboarding */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute requiredRole="student">
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* All Courses */}
        <Route
          path="/courses"
          element={
            <ProtectedRoute>
              <CourseManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Courses */}
        <Route
          path="/admin/courses"
          element={
            <ProtectedRoute requiredRole="admin">
              <CourseManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/courses/deleted"
          element={
            <ProtectedRoute requiredRole="admin">
              <DeletedCoursesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/courses/approved"
          element={
            <ProtectedRoute requiredRole="admin">
              <ApprovedCoursesPage />
            </ProtectedRoute>
          }
        />

        {/* Join Course via Invite Link */}
        <Route
          path="/courses/join"
          element={
            <ProtectedRoute>
              <JoinCoursePage />
            </ProtectedRoute>
          }
        />

        {/* Course detail */}

        <Route
          path="/courses/:id"
          element={
            <ProtectedRoute>
              <CourseDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/email-verify" element={<EmailVerifyPage />} />
        <Route
          path="/auth/verify-email/:code"
          element={<EmailVerificationPage />}
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:code" element={<ResetPasswordPage />} />

        <Route
          path="/my-courses"
          element={
            <ProtectedRoute>
              <MyCoursesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-courses-v2"
          element={
            <ProtectedRoute requiredRole="student">
              <MyCoursesV2Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-courses-v2/:semesterId"
          element={
            <ProtectedRoute requiredRole="student">
              <MyCoursesV2Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-enrollments"
          element={
            <ProtectedRoute requiredRole="student">
              <MyEnrollmentsPage />
            </ProtectedRoute>
          }
        />
        {/* Admin Dashboard - both paths for compatibility */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher-dashboard"
          element={
            <ProtectedRoute requiredRole="teacher">
              <TeacherDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Calendar */}
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />

        {/* Profile */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Lesson Materials */}
        <Route
          path="/materials"
          element={
            <ProtectedRoute>
              <ListAllLessonsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/materials/:lessonId"
          element={
            <ProtectedRoute>
              <LessonMaterialDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Assignments */}
        <Route
          path="/assignments"
          element={
            <ProtectedRoute>
              <AssignmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assignments/:id"
          element={
            <ProtectedRoute>
              <AssignmentDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Quiz Management */}

        <Route
          path="/questionbank"
          element={
            <ProtectedRoute>
              <QuizManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/questionbank/:courseId"
          element={
            <ProtectedRoute>
              <CourseQuizzesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/questionbank/questions/:quizId"
          element={
            <ProtectedRoute>
              <QuizQuestionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quizzes/:quizId/attempts"
          element={
            <ProtectedRoute requiredRole={["teacher", "admin"]}>
              <QuizAttemptsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz-attempts/:attemptId/grade"
          element={
            <ProtectedRoute requiredRole={["teacher", "admin"]}>
              <GradeAttemptPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz-attempts/:attemptId"
          element={
            <ProtectedRoute requiredRole={["teacher", "admin"]}>
              <QuizAttemptDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quizz"
          element={
            <ProtectedRoute>
              <QuizCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quizz/:courseId"
          element={
            <ProtectedRoute>
              <CourseQuizzesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quizz/:courseId/quiz/:quizId"
          element={
            <ProtectedRoute requiredRole="student">
              <TakeQuizPage />
            </ProtectedRoute>
          }
        />

        {/* About Us */}
        <Route path="/help/about" element={<AboutUsPage />} />

        {/* FAQ */}
        <Route path="/help/faq" element={<FAQPage />} />

        {/* Feedback */}
        <Route
          path="/help/feedback"
          element={
            <ProtectedRoute>
              <FeedbackPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help/feedback-list"
          element={
            <ProtectedRoute>
              <FeedbackListPage />
            </ProtectedRoute>
          }
        />

        {/* Enrollments */}
        <Route
          path="/enrollments-list"
          element={
            <ProtectedRoute>
              <EnrollmentsListPage />
            </ProtectedRoute>
          }
        />
        {/* Curriculum */}
        <Route
          path="/curriculum"
          element={
            <ProtectedRoute>
              <CurriculumPage />
            </ProtectedRoute>
          }
        />

        {/* User Bio - must come before /user to avoid route conflict */}
        <Route
          path="/user/:userId"
          element={
            <ProtectedRoute>
              <UserBioPage />
            </ProtectedRoute>
          }
        />

        {/* User Management */}
        <Route
          path="/user"
          element={
            <ProtectedRoute requiredRole="admin">
              <UserManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Attendance */}
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance/:semesterId"
          element={
            <ProtectedRoute>
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance/:semesterId/:courseId"
          element={
            <ProtectedRoute>
              <AttendancePage />
            </ProtectedRoute>
          }
        />

        {/* Forum */}
        <Route
          path="/forum"
          element={
            <ProtectedRoute>
              <ForumPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forum-list"
          element={
            <ProtectedRoute>
              <ForumListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forums/:forumId"
          element={
            <ProtectedRoute>
              <ForumDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forums/:forumId/posts/:postId"
          element={
            <ProtectedRoute>
              <ForumPostDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat-rooms"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat-rooms/:roomId"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-semester"
          element={
            <ProtectedRoute requiredRole="admin">
              <CreateSemesterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/semesters"
          element={
            <ProtectedRoute requiredRole="admin">
              <ListSemestersPage />
            </ProtectedRoute>
          }
        />
        <Route path="/blogs" element={<BlogPage />} />
        <Route path="/blogs/:slug" element={<BlogDetailPage />} />
        {/* Not found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      
      {/* Floating Chat Windows - inside Router for useNavigate */}
      <FloatingChatContainer />
    </Router>
  );
}

export default AppRoutes;
