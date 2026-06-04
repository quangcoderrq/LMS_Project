import appAssert from "../utils/appAssert";
import mongoose from "mongoose";
import LessonModel from "../models/lesson.model";
import CourseModel from "../models/course.model";
import { NOT_FOUND } from "../constants/http";
export type CreateLessonMaterial = {
    courseId: string;
    lessonId: string;
    title: string;
    description: string;
    type: string;
}
export const addlesson = async (data: CreateLessonMaterial, userId: string, userRole: mongoose.Types.ObjectId) => {
    const course = await CourseModel.findById(data.courseId);
    appAssert(course, NOT_FOUND, 'Course not found');

}

