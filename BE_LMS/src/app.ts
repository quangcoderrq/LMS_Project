import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Role } from './types';
import { uploadFile } from './utils/uploadFile';
import { Server } from 'socket.io';
import http from 'http';

//config
import upload from './config/multer';

//constants
import { OK } from './constants/http';
import { APP_ORIGIN } from './constants/env';

//middleware

import { authenticate, authorize, customResponse, errorHandler } from './middleware';

//routes
import {
  announcementRoutes,
  assignmentRoutes, 
  attendanceRoutes,
  authRoutes,
  courseInviteRoutes,
  courseRoutes,
  enrollmentRoutes,
  feedbackRoutes,
  forumProtectedRoutes,
  forumPublicRoutes,
  lessonMaterialRoutes,
  lessonProgressRoutes,
  lessonRoutes,
  majorProtectedRoutes,
  majorPublicRoutes,
  notificationRoutes,
  quizAttemptRoutes,
  quizQuestionRoutes,
  quizRoutes,
  scheduleRoutes,
  semesterRoutes,
  sessionRoutes,
  specialistProtectedRoutes,
  specialistPublicRoutes,
  subjectRoutes,
  submissionRoutes,
  userRoutes,
} from './routes';
import { socketAuthMiddleware } from './socket/middlewares/socketAuthMiddleware';
import initializeSocket from './socket/initializeSocket';
import messageRoutes from './routes/message.route';
import chatRoomRoutes from './routes/chatRoom.route';
import blogRoutes from './routes/blogRoutes.route';

export const createApp = async () => {
  const app = express();

  app.use(customResponse);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: APP_ORIGIN,
      credentials: true,
    })
  );
  app.use(cookieParser());

  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: APP_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  //example API----------------------------------
  app.get('/', (req, res) => {
    res.status(OK).send('Hello World!');
  });

  app.post('/uploadExample', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const result = await uploadFile(file, '/example');
    res.status(200).json(result);
  });
  //-----------------------------------------------

  //auth routes
  app.use('/auth', authRoutes);

  //routes
  app.use('/courses', courseRoutes);
  app.use('/assignments', assignmentRoutes);
  app.use('/submissions', submissionRoutes);
  app.use('/lessons', lessonRoutes);
  app.use('/lesson-materials', lessonMaterialRoutes);
  app.use('/lesson-progress', lessonProgressRoutes);
  app.use('/majors', majorPublicRoutes);
  app.use('/specialists', specialistPublicRoutes);
  app.use('/forums', forumPublicRoutes);
  app.use('/schedules', scheduleRoutes);
  app.use('/announcements', authenticate, announcementRoutes);
  app.use('/users', authenticate, userRoutes);
  app.use('/sessions', authenticate, authorize(Role.ADMIN), sessionRoutes);
  app.use('/enrollments', authenticate, enrollmentRoutes);
  app.use('/feedbacks', feedbackRoutes);
  app.use('/course-invites', authenticate, courseInviteRoutes);
  app.use('/quiz-questions', authenticate, quizQuestionRoutes);
  app.use('/majors', authenticate, majorProtectedRoutes);
  app.use('/specialists', authenticate, specialistProtectedRoutes);
  app.use('/forums', authenticate, forumProtectedRoutes);
  app.use('/subjects', authenticate, subjectRoutes);
  app.use('/quizzes', authenticate, authorize(Role.TEACHER, Role.ADMIN), quizRoutes);
  app.use('/notifications', authenticate, notificationRoutes);
  app.use('/quiz-attempts', authenticate, quizAttemptRoutes);
  app.use('/attendances', authenticate, attendanceRoutes);
  app.use('/semesters', semesterRoutes);
  app.use('/chat-rooms', authenticate, messageRoutes);
  app.use('/chat-rooms', authenticate, chatRoomRoutes);
  app.use('/blogs', blogRoutes);

  //socket
  io.use(socketAuthMiddleware);
  await initializeSocket(io);

  //error handler
  app.use(errorHandler);

  return httpServer;
};
