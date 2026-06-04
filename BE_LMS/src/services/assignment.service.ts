import AssignmentModel from "../models/assignment.model";
import CourseModel from "../models/course.model";
import EnrollmentModel from "../models/enrollment.model";
import AnnouncementModel from "../models/announcement.model";
import mongoose from "mongoose";
import appAssert from "../utils/appAssert";
import { NOT_FOUND, FORBIDDEN } from "../constants/http";
import { EnrollmentStatus } from "../types/enrollment.type";
import { Role } from "../types";
import { ensureTeacherAccessToCourse } from "./helpers/courseAccessHelpers";
import { uploadFile, removeFile, getSignedUrl } from "../utils/uploadFile";
import { prefixAssignmentFile } from "../utils/filePrefix";

export type ListAssignmentsParams = {
  page: number;
  limit: number;
  courseId?: mongoose.Types.ObjectId;
  search?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  sortBy?: string;
  sortOrder?: string;
  userId?: mongoose.Types.ObjectId;
  userRole?: Role;
};

export const listAssignments = async ({
  page,
  limit,
  courseId,
  search,
  dueBefore,
  dueAfter,
  sortBy = "createdAt",
  sortOrder = "desc",
  userId,
  userRole,
}: ListAssignmentsParams) => {
  // Build filter query
  const filter: any = {};

  if (courseId) {
    filter.courseId = courseId;
  }

  const emptyResult = {
    assignments: [],
    pagination: {
      total: 0,
      page,
      limit,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };

  //neu là std,ktra enrollment status
  if (userRole === Role.STUDENT && userId) {
    if (courseId) {
      const enrollment = await EnrollmentModel.findOne({
        studentId: userId,
        courseId: courseId,
        status: EnrollmentStatus.APPROVED,
      });
      appAssert(
        enrollment,
        FORBIDDEN,
        "You are not approved to access this course"
      );
    } else {
      //nếu không có courseId, chỉ list assignments của các course mà student đã được approved
      const approved = await EnrollmentModel.find({
        studentId: userId,
        status: EnrollmentStatus.APPROVED,
      }).select("courseId");
      const approvedCourseIds = approved.map((e: any) => e.courseId);
      //nếu approved courses, return empty
      if (!approvedCourseIds.length) {
        return emptyResult;
      }
      filter.courseId = { $in: approvedCourseIds };
    }
  }

  // nếu là teacher, chỉ xem được course của họ
  if (userRole === Role.TEACHER && userId) {
    if (courseId) {
      await ensureTeacherAccessToCourse({ courseId, userId, userRole });
    } else {
      const teacherCourses = await CourseModel.find({
        teacherIds: userId,
      })
        .select("_id")
        .lean();

      if (!teacherCourses.length) {
        return emptyResult;
      }

      const courseIds = teacherCourses.map((course: any) => course._id);
      filter.courseId = { $in: courseIds };
    }
  }

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }
  // lọc theo cratedAt
  if (dueAfter || dueBefore) {
  filter.createdAt = {};
  if (dueAfter) filter.createdAt.$gte = dueAfter;
  if (dueBefore) filter.createdAt.$lte = dueBefore;
}

  if (dueBefore) {
    filter.dueDate = { ...filter.dueDate, $lte: dueBefore };
  }

  if (dueAfter) {
    filter.dueDate = { ...filter.dueDate, $gte: dueAfter };
  }

  const skip = (page - 1) * limit;
  const sort: any = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  const [assignments, total] = await Promise.all([
    AssignmentModel.find(filter)
      .populate("courseId", "title code")
      .populate("createdBy", "username email fullname")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    AssignmentModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    assignments,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
  };
};

export const getAssignmentById = async (
  assignmentId: string,
  userId?: mongoose.Types.ObjectId,
  userRole?: Role
) => {
  const assignment = await AssignmentModel.findById(assignmentId)
    .populate("courseId", "title code")
    .populate("createdBy", "username email fullname")
    .lean();

  appAssert(assignment, NOT_FOUND, "Assignment not found");

  const courseIdValue =
    (assignment as any).courseId?._id || (assignment as any).courseId;

  //nếu là học sinh,ktra enrollment status
  if (userRole === Role.STUDENT && userId) {
    const enrollment = await EnrollmentModel.findOne({
      studentId: userId,
      courseId: courseIdValue,
      status: EnrollmentStatus.APPROVED,
    });
    appAssert(
      enrollment,
      FORBIDDEN,
      "You are not approved to access this course"
    );
  }

  await ensureTeacherAccessToCourse({
    courseId: courseIdValue,
    userId,
    userRole,
  });
//presigned cho file 
  let publicURL: string | null = null;
  const fileKey = (assignment as any).fileKey as string | undefined;
  const fileOriginalName = (assignment as any).fileOriginalName as string | undefined;

  if (fileKey) {
    publicURL = await getSignedUrl(fileKey, fileOriginalName || "assignment-file");
  }

  return {
    ...assignment,
    publicURL,
  };
};

export const createAssignment = async (
  data: any,
  userId?: mongoose.Types.ObjectId,
  userRole?: Role,
  file?: Express.Multer.File
) => {
  // Verify course exists
  const course = await CourseModel.findById(data.courseId);
  appAssert(course, NOT_FOUND, "Course not found");

  await ensureTeacherAccessToCourse({ course, userId, userRole });

  const createdBy = userId;
  const assignmentData: any = { ...data, createdBy };

  const assignment = await AssignmentModel.create(assignmentData);

  if (file) {
    const courseIdStr = (course as any)._id.toString();
    const assignmentIdStr = (assignment as any)._id.toString();

    const prefix = prefixAssignmentFile(courseIdStr, assignmentIdStr);
    const { key, originalName, mimeType, size } = await uploadFile(file, prefix);

    assignment.fileKey = key;
    assignment.fileOriginalName = originalName;
    assignment.fileMimeType = (mimeType as string) || undefined;
    assignment.fileSize = size;
    await assignment.save();
  }

  const populatedAssignment = await AssignmentModel.findById(assignment._id)
    .populate("courseId", "title code")
    .populate("createdBy", "username email fullname")
    .lean();

  const shouldAnnounce =
    (!!userRole && [Role.TEACHER, Role.ADMIN].includes(userRole)) &&
    !!data.courseId;

  if (shouldAnnounce && userRole) {
    const assignmentTitle =
      populatedAssignment?.title || data.title || "New assignment";
    const courseTitle = (course as any)?.title;
    const courseName = courseTitle ? ` for ${courseTitle}` : "";

    try {
      //tạo announcement cho course
      await AnnouncementModel.create({
        title: `New assignment: ${assignmentTitle}`,
        content: `A new assignment has been posted${courseName}. Please review the details and get started.`,
        courseId: data.courseId,
        authorId: createdBy as mongoose.Types.ObjectId,
      });
    } catch (error) {
      console.error("Failed to create assignment announcement", error);
    }
  }

  return populatedAssignment;
};

export const updateAssignment = async (
  assignmentId: string,
  data: any,
  userId?: mongoose.Types.ObjectId,
  userRole?: Role,
  file?: Express.Multer.File
) => {
  const assignment = await AssignmentModel.findById(assignmentId).select("courseId fileKey");
  appAssert(assignment, NOT_FOUND, "Assignment not found");

  if (userRole === Role.TEACHER && userId) {
    await ensureTeacherAccessToCourse({
      courseId: assignment.courseId as mongoose.Types.ObjectId,
      userId,
      userRole,
    });
  }

  // Nếu có file mới: xóa file cũ (nếu tồn tại) và upload file mới
  if (file) {
    if (assignment.fileKey) {
      await removeFile(assignment.fileKey);
    }

    const courseIdStr = (assignment.courseId as any).toString();
    const assignmentIdStr = (assignment as any)._id.toString();
    const prefix = prefixAssignmentFile(courseIdStr, assignmentIdStr);
    const { key, originalName, mimeType, size } = await uploadFile(
      file,
      prefix
    );

    data.fileKey = key;
    data.fileOriginalName = originalName;
    data.fileMimeType = (mimeType as string) || undefined;
    data.fileSize = size;
  }

  const updated = await AssignmentModel.findByIdAndUpdate(
    assignmentId,
    data,
    { new: true }
  )
    .populate("courseId", "title code")
    .populate("createdBy", "username email fullname")
    .lean();

  appAssert(updated, NOT_FOUND, "Assignment not found");
  return updated;
};

export const deleteAssignment = async (
  assignmentId: string,
  userId?: mongoose.Types.ObjectId,
  userRole?: Role
) => {
  if (userRole === Role.TEACHER && userId) {
    const assignment = await AssignmentModel.findById(assignmentId).select(
      "courseId"
    );
    appAssert(assignment, NOT_FOUND, "Assignment not found");

    await ensureTeacherAccessToCourse({
      courseId: assignment.courseId as mongoose.Types.ObjectId,
      userId,
      userRole,
    });
  }

  const assignment = await AssignmentModel.findByIdAndDelete(assignmentId);
  appAssert(assignment, NOT_FOUND, "Assignment not found");

  if (assignment.fileKey) {
    try {
      await removeFile(assignment.fileKey);
    } catch (err) {
      console.error(`Failed to remove assignment file ${assignment.fileKey} from MinIO:`, err);
    }
  }

  return assignment;
};
