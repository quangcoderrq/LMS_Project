import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import http from "../../utils/http";

interface JoinCourseResult {
  success: boolean;
  data?: {
    courseId: string;
    courseName?: string;
  };
  message: string;
}

const JoinCoursePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    const joinCourse = async () => {
      if (!token) {
        setError('No invite token provided');
        setLoading(false);
        return;
      }

      try {
        const response = await http.post<JoinCourseResult>('/course-invites/join', { token });
        
        if (response.success || response.data) {
          setSuccess(true);
          if (response.data?.courseId) {
            setCourseId(response.data.courseId);
          }
          if (response.data?.courseName) {
            setCourseName(response.data.courseName);
          }
        } else {
          setError(response.message || 'Failed to join course');
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || err.message || 'Failed to join course';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    joinCourse();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Joining Course...</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we process your invite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        {success ? (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Successfully Joined!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {courseName 
                ? `You have successfully joined the course "${courseName}".`
                : 'You have successfully joined the course.'
              }
            </p>
            <div className="space-y-3">
              {courseId && (
                <button
                  onClick={() => navigate(`/courses/${courseId}`)}
                  className="block w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Course
                </button>
              )}
              <Link
                to="/my-courses"
                className="block w-full px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                View My Courses
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Join Failed</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error || 'The invite link is invalid or has expired.'}
            </p>
            <div className="space-y-3">
              <Link
                to="/courses"
                className="block w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Courses
              </Link>
              <Link
                to="/my-courses"
                className="block w-full px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                My Courses
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinCoursePage;
